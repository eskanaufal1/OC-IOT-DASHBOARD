"""
LLM Service — LangGraph-orchestrated RAG with session management and database persistence.
"""
import logging
import re
import time
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

_DB_ENABLED = True

_PIPE_DUMP = re.compile(r"\| (Type|Unit|Range):")


def _clean_response(text: str) -> str:
    """Reformat raw context dumps into readable structure."""
    if not text or not _PIPE_DUMP.search(text):
        return text

    lines = text.split(" | ")
    out = []
    for i, part in enumerate(lines):
        part = part.strip()
        if i == 0 and ":" not in part:
            out.append(f"**{part}**")
            continue
        for label in ("Type:", "Unit:", "Range:", "Stats for"):
            if part.startswith(label):
                part = part[len(label):].strip()
                if label == "Type:":
                    out.append(f"  Type: {part}")
                elif label == "Unit:":
                    out.append(f"  Unit: {part}")
                elif label == "Range:":
                    out.append(f"  Range: {part}")
                break
        else:
            if part and not out[-1].endswith(part):
                out.append(part)
    return "\n".join(out)


async def _save_message_safe(session_id, user_id, role, content):
    global _DB_ENABLED
    if not _DB_ENABLED:
        return
    try:
        from database.repository import save_message
        await save_message(session_id, user_id, role, content)
    except Exception as e:
        logger.warning(f"DB save failed (disabling persistence): {e}")
        _DB_ENABLED = False


async def _create_session_safe(user_id, title):
    global _DB_ENABLED
    if not _DB_ENABLED:
        import uuid
        sid = str(uuid.uuid4())
        return {"id": sid, "title": title, "created_at": "", "updated_at": ""}
    try:
        from database.repository import create_session
        return await create_session(user_id, title)
    except Exception as e:
        logger.warning(f"DB session create failed (disabling persistence): {e}")
        _DB_ENABLED = False
        import uuid
        sid = str(uuid.uuid4())
        return {"id": sid, "title": title, "created_at": "", "updated_at": ""}


async def _get_sessions_safe(user_id):
    global _DB_ENABLED
    if not _DB_ENABLED:
        return []
    try:
        from database.repository import get_sessions
        return await get_sessions(user_id)
    except Exception as e:
        logger.warning(f"DB sessions list failed: {e}")
        return []


async def _get_messages_safe(session_id):
    global _DB_ENABLED
    if not _DB_ENABLED:
        return []
    try:
        from database.repository import get_messages
        return await get_messages(session_id)
    except Exception as e:
        logger.warning(f"DB messages fetch failed: {e}")
        return []


async def _delete_session_safe(session_id):
    global _DB_ENABLED
    if not _DB_ENABLED:
        return False
    try:
        from database.repository import delete_session
        return await delete_session(session_id)
    except Exception as e:
        logger.warning(f"DB session delete failed: {e}")
        return False


async def query_with_session(
    question: str, session_id: Optional[str], user_id: int
) -> Tuple[str, str, Optional[str]]:
    from services.graph import get_graph
    from services.chat_manager import generate_title, _safety_fallback
    from services.vector_store import get_vector_store

    is_new = not session_id

    if is_new:
        title = generate_title(question)
        session = await _create_session_safe(user_id, title)
        session_id = session["id"]
    else:
        title = None

    await _save_message_safe(session_id, user_id, "user", question)

    history = await _get_messages_safe(session_id)
    history_for_graph = [
        {"role": m["role"], "content": m["content"]} for m in history[-10:]
    ]

    graph = get_graph()
    config = {"configurable": {"thread_id": session_id}}

    start = time.time()
    try:
        result = await graph.ainvoke(
            {
                "question": question,
                "original_question": question,
                "session_id": session_id,
                "user_id": user_id,
                "conversation_history": history_for_graph,
                "context_chunks": [],
                "is_relevant": True,
                "rewrite_count": 0,
                "response": "",
            },
            config,
        )
        response = result.get("response", "")
    except Exception as e:
        logger.warning(f"LangGraph invocation failed: {e}")
        response = _safety_fallback(question, history)
    elapsed = time.time() - start

    if not response:
        response = _safety_fallback(question, history)

    response = _clean_response(response)
    response += f"\n\n---\n*{elapsed:.1f}s*"

    await _save_message_safe(session_id, user_id, "assistant", response)

    return response, session_id, title


async def list_sessions(user_id: int) -> list[dict]:
    return await _get_sessions_safe(user_id)


async def get_session_msgs(session_id: str) -> list[dict]:
    return await _get_messages_safe(session_id)


async def remove_session(session_id: str) -> bool:
    return await _delete_session_safe(session_id)


async def reindex_knowledge_base() -> int:
    from services.vector_store import reset_vector_store, get_vector_store
    reset_vector_store()
    store = get_vector_store()
    return store.build_index(force=True)
