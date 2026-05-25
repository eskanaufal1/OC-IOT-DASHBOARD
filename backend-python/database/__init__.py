import aiosqlite
import logging
import os

logger = logging.getLogger(__name__)

DB_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_PATH = os.path.join(DB_DIR, "chat.db")


def _get_conn() -> aiosqlite.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    return aiosqlite.connect(DB_PATH)


async def get_pool():
    return _get_conn()


async def init_db():
    os.makedirs(DB_DIR, exist_ok=True)
    async with _get_conn() as db:
        db.row_factory = aiosqlite.Row
        await db.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT DEFAULT 'New Chat',
                thread_id TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
                user_id INTEGER,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_id, updated_at DESC)"
        )
        await db.execute("PRAGMA foreign_keys = ON")
        await db.commit()
        logger.info(f"SQLite database initialized at {DB_PATH}")


async def close_db():
    pass
