import logging
import uuid
from datetime import datetime, timezone

from database import _get_conn

logger = logging.getLogger(__name__)


async def create_session(user_id: int, title: str = "New Chat") -> dict:
    sid = str(uuid.uuid4())
    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    async with _get_conn() as db:
        db.row_factory = lambda c, r: r
        await db.execute(
            "INSERT INTO chat_sessions (id, user_id, title, thread_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (sid, user_id, title, tid, now, now),
        )
        await db.commit()
    return {"id": sid, "title": title, "created_at": now, "updated_at": now}


async def get_sessions(user_id: int) -> list[dict]:
    async with _get_conn() as db:
        db.row_factory = lambda c, r: r
        cur = await db.execute(
            """SELECT s.id, s.title, s.created_at, s.updated_at,
                      (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as msg_count
               FROM chat_sessions s
               WHERE s.user_id = ?
               ORDER BY s.updated_at DESC""",
            (user_id,),
        )
        rows = await cur.fetchall()
    return [
        {"id": r[0], "title": r[1], "message_count": r[4],
         "created_at": r[2], "updated_at": r[3]}
        for r in rows
    ]


async def delete_session(session_id: str) -> bool:
    async with _get_conn() as db:
        cur = await db.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        await db.commit()
        return cur.rowcount > 0


async def save_message(session_id: str, user_id: int, role: str, content: str) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    async with _get_conn() as db:
        db.row_factory = lambda c, r: r
        cur = await db.execute(
            "INSERT INTO chat_messages (session_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, user_id, role, content, now),
        )
        await db.execute(
            "UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id)
        )
        await db.commit()
        msg_id = cur.lastrowid
    return {"id": msg_id, "session_id": session_id, "user_id": user_id,
            "role": role, "content": content, "created_at": now}


async def get_messages(session_id: str) -> list[dict]:
    async with _get_conn() as db:
        db.row_factory = lambda c, r: r
        cur = await db.execute(
            "SELECT id, session_id, user_id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        )
        rows = await cur.fetchall()
    return [
        {"id": r[0], "session_id": r[1], "user_id": r[2],
         "role": r[3], "content": r[4], "created_at": r[5]}
        for r in rows
    ]


async def update_session_title(session_id: str, title: str):
    now = datetime.now(timezone.utc).isoformat()
    async with _get_conn() as db:
        await db.execute(
            "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, session_id),
        )
        await db.commit()
