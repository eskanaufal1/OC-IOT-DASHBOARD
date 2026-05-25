import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, chat

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting IoT LLM Service (Ollama + ChromaDB + LangGraph)...")

    try:
        from database import init_db, close_db
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database init failed: {e}")

    try:
        from services.vector_store import get_vector_store
        store = get_vector_store()
        count = store.build_index()
        logger.info(f"Vector store ready: {count} chunks (ChromaDB: {store.use_chromadb})")
    except Exception as e:
        logger.error(f"Vector store init failed: {e}")

    try:
        from services.chat_manager import _check_ollama, get_available_models, get_active_model
        available = await _check_ollama()
        if available:
            models = get_available_models()
            active = get_active_model()
            logger.info(f"Ollama: {len(models)} models available, active: {active['model']}")
        else:
            logger.warning("Ollama not reachable — will use fallback responses")
    except Exception as e:
        logger.error(f"Ollama init failed: {e}")

    try:
        from services.graph import build_graph
        build_graph()
        logger.info("LangGraph workflow compiled")
    except Exception as e:
        logger.error(f"LangGraph build failed: {e}")

    yield

    try:
        from database import close_db
        await close_db()
    except Exception:
        pass
    logger.info("Shutting down IoT LLM Service")


app = FastAPI(
    title="IoT LLM Service",
    description="LangGraph + RAG + ChromaDB + llama-cpp (GGUF) — session-aware AI chatbot",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def root_health():
    result = {"status": "healthy", "version": "4.0.0", "rag": {}, "db": False}
    try:
        from services.vector_store import get_vector_store
        store = get_vector_store()
        result["rag"]["chunks_indexed"] = store.chunks_count
        result["rag"]["chromadb_enabled"] = store.use_chromadb
    except Exception:
        pass
    try:
        from services.chat_manager import get_active_model
        result["model"] = get_active_model()
    except Exception:
        pass
    try:
        from database import get_pool
        pool = await get_pool()
        if pool:
            result["db"] = True
    except Exception:
        pass
    return result


app.include_router(chat.router, prefix="/chat")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
