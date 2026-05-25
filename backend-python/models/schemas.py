from pydantic import BaseModel
from typing import Optional


class QueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    user_id: int = 1


class QueryResponse(BaseModel):
    response: str
    session_id: str
    title: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    title: str
    message_count: int
    created_at: str
    updated_at: str


class HealthResponse(BaseModel):
    status: str
    version: str
