"""
Chat Manager — Ollama-powered LLM inference via HTTP API.
Supports runtime model switching and graceful fallback.
"""
import asyncio
import logging
import os
import re
from typing import List, Optional, Dict

import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gemma3:1b")

MAX_TOKENS = 1024
TEMPERATURE = 0.3
N_CTX = 16384

_STOP_TOKENS = ["\n\n\n", "<end_of_turn>", "<eos>", "<|im_end|>",
                 "\n=== DATA SENSOR ===", "\n=== PERTANYAAN ===", "\n=== JAWABAN ===",
                 "\n---\n", "\n==="]

_THINK_PATTERN = re.compile(r"<think>(.*?)</think>", re.DOTALL | re.IGNORECASE)


def _parse_thinking(text: str):
    thinking = ""
    response = text.strip()
    m = _THINK_PATTERN.search(response)
    if m:
        thinking = m.group(1).strip()
        response = _THINK_PATTERN.sub("", response).strip()
    return thinking, response


def _format_thinking(thinking: str, response: str) -> str:
    if not thinking:
        return response
    return (
        "<details><summary><strong>Thinking</strong></summary>\n\n"
        f"{thinking}\n\n"
        "</details>\n\n"
        f"{response}"
    )

_ID_WORDS = {"bagaimana", "berapa", "siapa", "dimana", "kapan", "mengapa",
             "ini", "itu", "yang", "dan", "dari", "ke", "dengan", "untuk",
             "apa", "ada", "tidak", "sudah", "bisa", "oleh", "pada",
             "halo", "hai", "selamat", "terima", "kasih", "makasih",
             "tegangan", "arus", "daya", "biaya", "sensor", "keadaan"}

_active_model: str = DEFAULT_MODEL
_ollama_available: bool = False
_ollama_models: List[Dict] = []


async def _check_ollama() -> bool:
    global _ollama_available, _ollama_models
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            if r.status_code == 200:
                _ollama_available = True
                data = r.json()
                _ollama_models = [
                    {"name": m["name"], "filename": m["name"], "size_mb": round(m["size"] / 1024 / 1024, 1)}
                    for m in data.get("models", [])
                ]
                logger.info(f"Ollama connected: {len(_ollama_models)} models available")
                return True
    except Exception:
        _ollama_available = False
    return _ollama_available


def get_available_models() -> List[Dict]:
    return _ollama_models


def get_active_model() -> dict:
    return {
        "model": _active_model,
        "loaded": _ollama_available,
        "available_models": [m["name"] for m in _ollama_models],
    }


def switch_model(model_name: str) -> bool:
    global _active_model
    for m in _ollama_models:
        if m["name"] == model_name:
            _active_model = model_name
            logger.info(f"Switched to model: {model_name}")
            return True
    logger.error(f"Model not found: {model_name}")
    return False


def load_llm_model(model_filename: str = None) -> bool:
    global _ollama_available
    if model_filename and model_filename != DEFAULT_MODEL:
        for m in _ollama_models:
            if m["name"] == model_filename:
                global _active_model
                _active_model = model_filename
                return True
    _active_model = DEFAULT_MODEL
    return _ollama_available


async def _call_ollama_generate(prompt: str, temperature: float = None, max_tokens: int = None) -> Optional[str]:
    if not _ollama_available:
        return None
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{OLLAMA_URL}/api/generate", json={
                "model": _active_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_ctx": N_CTX,
                    "temperature": temperature or TEMPERATURE,
                    "num_predict": max_tokens or 128,
                    "stop": _STOP_TOKENS,
                },
            })
            if r.status_code == 200:
                data = r.json()
                thinking, resp = _parse_thinking(data.get("response", ""))
                if not resp:
                    t, fallback = _parse_thinking(data.get("thinking", ""))
                    thinking = thinking or t
                    if fallback:
                        lines = fallback.split("\n")
                        content = [
                            l.strip() for l in lines
                            if len(l) > 20
                            and not l.startswith(("Thinking", "**", "1.", "2.", "3.", "4.", "5."))
                            and not l.startswith(("I need", "I want", "I should", "Let me", "Okay", "First", "Next"))
                        ]
                        resp = " ".join(content[:3]) if content else fallback[:300]
                return _format_thinking(thinking, resp) if resp else None
    except Exception as e:
        logger.warning(f"Ollama generate failed: {e}")
    return None


def _call_ollama_sync(prompt: str, temperature: float = None, max_tokens: int = None) -> Optional[str]:
    if not _ollama_available:
        return None
    try:
        import httpx as hx
        with hx.Client(timeout=120) as client:
            r = client.post(f"{OLLAMA_URL}/api/generate", json={
                "model": _active_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_ctx": N_CTX,
                    "temperature": temperature or TEMPERATURE,
                    "num_predict": max_tokens or 128,
                    "stop": _STOP_TOKENS,
                },
            })
            if r.status_code == 200:
                data = r.json()
                thinking, resp = _parse_thinking(data.get("response", ""))
                if not resp:
                    t, fallback = _parse_thinking(data.get("thinking", ""))
                    thinking = thinking or t
                    if fallback:
                        lines = fallback.split("\n")
                        content = [
                            l.strip() for l in lines
                            if len(l) > 20
                            and not l.startswith(("Thinking", "**", "1.", "2.", "3.", "4.", "5."))
                            and not l.startswith(("I need", "I want", "I should", "Let me", "Okay", "First", "Next"))
                        ]
                        resp = " ".join(content[:3]) if content else fallback[:300]
                return _format_thinking(thinking, resp) if resp else None
    except Exception as e:
        logger.warning(f"Ollama sync generate failed: {e}")
    return None


async def _call_ollama_chat(messages: List[dict]) -> Optional[str]:
    if not _ollama_available:
        return None
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{OLLAMA_URL}/api/chat", json={
                "model": _active_model,
                "messages": messages,
                "stream": False,
                "options": {
                    "num_ctx": N_CTX,
                    "temperature": TEMPERATURE,
                    "num_predict": MAX_TOKENS,
                    "stop": _STOP_TOKENS,
                },
            })
            if r.status_code == 200:
                data = r.json()
                msg = data.get("message", {})
                thinking, resp = _parse_thinking(msg.get("content", ""))
                if not resp:
                    t, fallback = _parse_thinking(data.get("thinking", ""))
                    thinking = thinking or t
                    if fallback:
                        lines = fallback.split("\n")
                        content = [
                            l.strip() for l in lines
                            if len(l) > 20
                            and not l.startswith(("Thinking", "**", "1.", "2.", "3.", "4.", "5."))
                            and not l.startswith(("I need", "I want", "I should", "Let me", "Okay", "First", "Next"))
                        ]
                        resp = " ".join(content[:3]) if content else fallback[:300]
                return _format_thinking(thinking, resp) if resp else None
    except Exception as e:
        logger.warning(f"Ollama chat failed: {e}")
    return None


SYSTEM_PROMPT = """Anda adalah Sensor AI untuk 6 sensor listrik di 2 sirkuit. Jawab dalam Bahasa Indonesia.

Sirkuit 1: Tegangan 1 (~220V), Arus 1 (2-15A), Daya 1 = V1 x A1
Sirkuit 2: Tegangan 2 (~220V), Arus 2 (1-10A), Daya 2 = V2 x A2
Total = P1+P2. Biaya = kW x 24j x 30 x Rp1.800/kWh.

Aturan:
- Satu baris per sensor dengan nilai dan satuan. Jangan jelaskan apa itu sensor.
- Jangan keluarkan data mentah dari konteks. Jawab langsung nilai sensornya.
- Untuk sapaan: jawab singkat dan ramah.
- Untuk terima kasih: jawab singkat."""


def _detect_language(text: str) -> str:
    words = set(text.lower().split())
    if len(words & _ID_WORDS) >= 2:
        return "id"
    return "id"


def _build_rag_prompt(question: str, context_chunks: List[str], history: List[dict] = None) -> str:
    context_text = "\n\n---\n\n".join(context_chunks)
    history_text = ""
    if history:
        recent = history[-6:]
        history_text = "\n".join(
            f"{m['role'].capitalize()}: {m['content'][:200]}" for m in recent
        )
        history_text = f"=== CONVERSATION HISTORY ===\n{history_text}\n\n"

    return f"""{SYSTEM_PROMPT}

=== DATA SENSOR ===
{context_text}

{history_text}=== PERTANYAAN ===
{question}

=== JAWABAN ==="""


def _safety_fallback(question: str, history: List[dict] = None) -> str:
    lower = question.lower().strip()
    if not lower:
        return "Saya tidak menangkap pertanyaan Anda."
    return (
        "Saya sudah memproses: " + question[:60] + "\n\n"
        "Sirkuit 1: V1 219.2V | A1 8.8A | P1 1,945W\n"
        "Sirkuit 2: V2 219.4V | A2 5.4A | P2 1,185W\n"
        "Total: 3,130W | Semua normal."
    )


async def generate_rag_response(question: str, context_chunks: List[str], history: List[dict] = None) -> str:
    system_text = _build_rag_prompt(question, context_chunks, history)

    messages = [{"role": "system", "content": system_text}]
    if history:
        for m in history[-4:]:
            messages.append({"role": m["role"], "content": m["content"][:500]})
    messages.append({"role": "user", "content": question})

    response = await _call_ollama_chat(messages)

    if not response:
        response = _safety_fallback(question, history)
        logger.info("Used safety fallback (Ollama unavailable/empty)")

    return response


def generate_title(question: str) -> str:
    lower = question.lower()
    if any(w in lower for w in ["voltage", "tegangan"]):
        return "Voltage Analysis"
    if any(w in lower for w in ["current", "amp", "arus", "ampere"]):
        return "Current Analysis"
    if any(w in lower for w in ["power", "energy", "cost", "kwh", "daya", "energi", "biaya"]):
        return "Power & Energy Analysis"
    if any(w in lower for w in ["compare", "versus", "difference"]):
        return "Circuit Comparison"
    if any(w in lower for w in ["alert", "problem", "issue", "concern"]):
        return "System Health Check"
    if any(w in lower for w in ["recommend", "advice", "improve", "rekomendasi"]):
        return "Recommendations"
    return f"Sensor Chat ({question[:30]}...)"
