# IoT Dashboard

AI-powered IoT monitoring dashboard with real-time sensor visualization and RAG-grounded AI chatbot.

## Architecture

```
Frontend (React + Vite :5174) → Go API (:8002) → Python LLM (:8001) → Ollama (:11434)
                                      ↓                    ↓
                                 PostgreSQL         ChromaDB + SQLite
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind v4, shadcn/ui, Recharts, Three.js |
| Backend | Go 1.25, JWT auth, WebSocket, Gorilla WebSocket |
| LLM | Python FastAPI, LangGraph, Ollama, ChromaDB, sentence-transformers |
| Database | SQLite (chat sessions), ChromaDB (vector store), PostgreSQL (optional) |
| Models | gemma3:1b, qwen3:0.6b, lfm2.5-thinking, qwen3.5:2b |

## Quick Start

### Prerequisites

- [Ollama](https://ollama.com) installed and running
- Node.js 22+
- Go 1.25+
- Python 3.12+

### 1. Install Ollama & pull models

```bash
ollama pull gemma3:1b
ollama pull qwen3:0.6b
```

### 2. Install dependencies

```bash
# Python
cd backend-python
pip install -r requirements.txt

# Frontend
cd frontend
npm install

# Go (already built)
cd backend-go
go build -o iot-backend.exe .
```

### 3. Start all services

```bash
# Using PM2 (recommended)
pm2 start ecosystem.config.cjs

# Or manually
cd backend-python && python main.py          # :8001
cd backend-go && ./iot-backend.exe           # :8002
cd frontend && npm run dev                   # :5174
```

### 4. Access

- **Dashboard**: http://localhost:5174
- **Login**: `admin` / `admin123`
- **API**: http://localhost:8002/api/v1
- **LLM Health**: http://localhost:8001/health

## Sensors

6 sensors monitoring 2 circuits:

| Circuit 1 (primary) | Circuit 2 (secondary) |
|---------------------|----------------------|
| **Voltage 1** (~220V) | **Voltage 2** (~220V) |
| **Current 1** (2-15A) | **Current 2** (1-10A) |
| **Power 1** (V1×A1) | **Power 2** (V2×A2) |

## API Endpoints (Go — :8002)

```
POST /api/v1/auth/login          → JWT token
GET  /api/v1/sensors             → sensor list
GET  /api/v1/sensors/:id/history → time-series data
GET  /api/v1/chat/history        → chat messages
POST /api/v1/chat/query          → AI query
GET  /api/v1/chat/sessions       → sessions list
DELETE /api/v1/chat/sessions/:id → delete session
GET  /api/v1/chat/models         → available models
POST /api/v1/chat/model          → switch model
GET  /api/v1/users/me            → current user
WS   /ws                          → live sensor updates
```

## Chatbot Features

- **LangGraph RAG** pipeline: retrieve → grade → generate
- **Session management** with SQLite persistence
- **4 switchable models** from the chatbot dropdown
- **Indonesian & English** language support
- **Thinking section** for models that output reasoning
- **Processing time** displayed per response
- **Conversation history** across multi-turn chats

## Project Structure

```
OC-IOT-THESIS/
├── frontend/                # React + Vite + Tailwind
│   └── src/
│       ├── components/      # UI components + ThreeBackground
│       ├── pages/           # Dashboard, Chatbot, Login, etc.
│       └── lib/             # API client, theme, utils
├── backend-go/              # Go REST API
│   └── internal/
│       ├── handlers/        # Auth, sensors, chat, users, WS
│       ├── middleware/       # JWT, CORS
│       └── models/          # Data structures
├── backend-python/          # Python LLM service
│   ├── services/
│   │   ├── chat_manager.py  # Ollama integration
│   │   ├── graph.py         # LangGraph workflow
│   │   ├── llm_service.py   # RAG orchestration
│   │   └── vector_store.py  # ChromaDB knowledge base
│   ├── database/            # SQLite repository
│   └── routers/             # FastAPI endpoints
├── schema.sql               # PostgreSQL schema (optional)
├── ecosystem.config.cjs     # PM2 process config
└── AGENTS.md                # AI agent context file
```
