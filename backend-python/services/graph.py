"""
LangGraph workflow — RAG-grounded sensor analysis with relevance grading and query rewriting.
Uses Ollama HTTP API for LLM inference.
"""
import logging
from typing import List, Optional

from langgraph.graph import StateGraph, END
from langgraph.graph.state import CompiledStateGraph
from typing_extensions import TypedDict

from services.vector_store import get_vector_store
from services.chat_manager import _call_ollama_sync, _build_rag_prompt, _safety_fallback

logger = logging.getLogger(__name__)

MAX_REWRITES = 2
_graph: Optional[CompiledStateGraph] = None


class GraphState(TypedDict):
    question: str
    original_question: str
    session_id: str
    user_id: int
    conversation_history: list
    context_chunks: list
    is_relevant: bool
    rewrite_count: int
    response: str


_SAFE_GREETINGS = {"hello", "hi", "hey", "thanks", "thank", "help", "good morning",
                   "good afternoon", "good evening", "how are you", "what's up",
                   "who are you", "what can you do", "what do you do"}


def _grade_with_llm(question: str, chunks: List[str]) -> bool:
    context_text = "\n---\n".join(chunks[:5])
    prompt = f"""Is this context sufficient to answer the question? Reply YES or NO.

Question: {question}

Context: {context_text}

Answer:"""
    result = _call_ollama_sync(prompt, temperature=0.0, max_tokens=4)
    if result is None:
        return len(context_text) > 100
    return "YES" in result.upper()[:8]


def _rewrite_query(question: str) -> str:
    prompt = f"""Rephrase this question for better search. Be specific about sensors and units.

Original: {question}

Rewritten:"""
    result = _call_ollama_sync(prompt, temperature=0.0, max_tokens=64)
    if result is None or len(result) < 3:
        return question
    return result.strip()


async def _retrieve(state: GraphState) -> GraphState:
    question = state["question"]
    store = get_vector_store()
    results = store.search(question, top_k=8)
    state["context_chunks"] = [chunk for chunk, score in results if score > 0.1]
    if not state["context_chunks"]:
        state["context_chunks"] = [chunk for chunk, _ in results[:3]]
    return state


async def _grade_relevance(state: GraphState) -> GraphState:
    chunks = state["context_chunks"]
    original = state.get("original_question", state["question"])
    lower_orig = original.lower().strip()
    if lower_orig in _SAFE_GREETINGS or len(lower_orig.split()) <= 3:
        state["is_relevant"] = True
        return state
    if not chunks:
        state["is_relevant"] = False
        return state
    state["is_relevant"] = _grade_with_llm(state["question"], chunks)
    return state


async def _rewrite(state: GraphState) -> GraphState:
    state["rewrite_count"] = state.get("rewrite_count", 0) + 1
    state["question"] = _rewrite_query(state["question"])
    logger.info(f"Query rewritten (attempt {state['rewrite_count']}): {state['question'][:100]}")
    return state


async def _generate(state: GraphState) -> GraphState:
    from services.chat_manager import _call_ollama_chat

    original = state.get("original_question", state["question"])
    chunks = state["context_chunks"]
    history = state.get("conversation_history", [])

    system_text = _build_rag_prompt(state["question"], chunks, history)

    messages = [{"role": "system", "content": system_text}]
    if history:
        for m in history[-4:]:
            messages.append({"role": m["role"], "content": m["content"][:500]})
    messages.append({"role": "user", "content": state["question"]})

    response = _call_ollama_sync(system_text, temperature=0.3, max_tokens=512)

    bad_prefixes = ("",)
    if response and len(response.strip()) >= 3:
        clean = response.strip()
        bad_prefixes = ("<|im_start|>", "<|im_end|>", "Use bullet", "Be concise",
                         "If data", "Provide a", "Ground answers", "For greetings",
                         "**Note**:", "YOUR RESPONSE", "Based on the sensor")
        if not any(clean.startswith(p) for p in bad_prefixes):
            state["response"] = clean
            return state

    logger.info(f"LLM output rejected [{len(response or '')} chars] — using safety fallback")
    state["response"] = _safety_fallback(original, history)
    return state


def _should_rewrite(state: GraphState) -> str:
    if state["is_relevant"]:
        return "generate"
    if state.get("rewrite_count", 0) >= MAX_REWRITES:
        return "generate"
    return "rewrite"


def build_graph() -> CompiledStateGraph:
    global _graph
    if _graph is not None:
        return _graph

    builder = StateGraph(GraphState)
    builder.add_node("retrieve", _retrieve)
    builder.add_node("grade_relevance", _grade_relevance)
    builder.add_node("rewrite_query", _rewrite)
    builder.add_node("generate", _generate)
    builder.set_entry_point("retrieve")
    builder.add_edge("retrieve", "grade_relevance")
    builder.add_conditional_edges("grade_relevance", _should_rewrite, {
        "generate": "generate",
        "rewrite": "rewrite_query",
    })
    builder.add_edge("rewrite_query", "retrieve")
    builder.add_edge("generate", END)
    _graph = builder.compile()
    logger.info("LangGraph workflow compiled")
    return _graph


def get_graph() -> CompiledStateGraph:
    return build_graph()
