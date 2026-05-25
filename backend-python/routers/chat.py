from fastapi import APIRouter, HTTPException, Query
from models.schemas import QueryRequest, QueryResponse, SessionResponse
from services.llm_service import query_with_session, get_session_msgs, list_sessions, remove_session
from services.chat_manager import get_available_models, get_active_model, switch_model

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def chat_query(request: QueryRequest) -> QueryResponse:
    try:
        response, session_id, title = await query_with_session(
            request.question,
            request.session_id,
            request.user_id,
        )
        return QueryResponse(response=response, session_id=session_id, title=title)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def list_user_sessions(user_id: int = Query(1)):
    try:
        sessions = await list_sessions(user_id)
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    try:
        msgs = await get_session_msgs(session_id)
        return {"session_id": session_id, "messages": msgs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    try:
        ok = await remove_session(session_id)
        if not ok:
            raise HTTPException(status_code=404, detail="session not found")
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def chat_history(session_id: str = Query(None), user_id: int = Query(1)):
    try:
        if session_id:
            msgs = await get_session_msgs(session_id)
            return msgs
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reindex")
async def reindex():
    try:
        from services.llm_service import reindex_knowledge_base
        count = await reindex_knowledge_base()
        return {"status": "ok", "chunks_indexed": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_models():
    models = get_available_models()
    active = get_active_model()
    return {"models": models, "active": active["model"], "loaded": active["loaded"]}


@router.get("/model")
async def current_model():
    return get_active_model()


@router.post("/model")
async def change_model(data: dict):
    model_name = data.get("model", "")
    if not model_name:
        raise HTTPException(status_code=400, detail="model name required")
    success = switch_model(model_name)
    if not success:
        active = get_active_model()
        if active["loaded"]:
            return active
        raise HTTPException(status_code=400, detail=f"model '{model_name}' failed to load and no fallback available")
    return get_active_model()
