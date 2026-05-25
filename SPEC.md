# IoT Dashboard — SPEC.md

> Technical specification. Describes what's built, how it works, and why.

---

## 1. Overview

**Name:** AI IoT Dashboard
**Type:** Real-time monitoring + AI chatbot web application
**Stack:** React 19 (frontend) / Go (API) / Python (LLM) / PostgreSQL / MQTT

Monitors electrical sensors (voltage, amperage, power) published via MQTT. Visualizes time-series data in interactive charts. Provides a RAG-grounded AI chatbot that answers questions about sensor data.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                     │
│  https://iot.ernstudio.my.id                            │
└──────────────┬──────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────────────┐
│  Go Backend (:8002) — iot-backend                       │
│  ├── REST API (auth, sensors, devices, chat)            │
│  └── WebSocket (/ws) — live sensor updates             │
│         │                            │                   │
│    ┌────▼────────┐          ┌──────▼──────┐            │
│    │ PostgreSQL   │          │ Python LLM  │            │
│    │ :5433        │          │ :8001       │            │
│    └─────────────┘          └─────────────┘            │
│         │                                             │
│    ┌────▼────────┐                                   │
│    │ MQTT Broker  │ ← mqtt_sensor_publisher.py       │
│    │ (local)      │   publishes sensor readings       │
│    └─────────────┘                                   │
└───────────────────────────────────────────────────────┘
```

### Services

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| Frontend | React/Vite | 5174 | SPA (proxied via Cloudflare tunnel) |
| Go API | Go | 8002 | REST + WebSocket |
| Python LLM | Python | 8001 | RAG chatbot (ollama) |
| PostgreSQL | — | 5433 | Primary database |
| MQTT Broker | — | 1883 | Sensor data ingestion |

---

## 3. Frontend

### Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | `LoginPage` | JWT authentication |
| `/` | `DashboardPage` | KPI cards, live chart, device overview |
| `/statistics` | `StatisticsPage` | Historical sensor charts |
| `/devices` | `DevicesPage` | Device management CRUD |
| `/chatbot` | `ChatbotPage` | RAG AI chat interface |
| `/profile` | `ProfilePage` | User profile + password |

### State Management

- React hooks + local state. No Redux.
- WebSocket (`/ws`) for real-time sensor updates on Dashboard.
- Fetch API (no axios) for REST calls.

### Components (shadcn/ui)

- `button`, `card`, `input`, `label`, `badge`, `table`, `avatar`, `sheet`, `dialog`, `select`, `switch`, `tabs`, `skeleton`, `tooltip`, `separator`, `toggle`, `navigation-menu`, `accordion`, `scroll-area`, `sonner`, `command`, `sidebar`, `toggle-group`, `input-otp`

### Design System

**PlayStation Dark theme** — dark canvas (`#000`), surface cards (`#181818`), primary blue (`#0070d1`).

CSS variables in `index.css` via Tailwind v4 `@theme` block.

---

## 4. Backend (Go — :8002)

### Handlers

| Handler | File | Responsibility |
|---------|------|----------------|
| Auth | `internal/handlers/auth.go` | JWT login (mock user DB) |
| Sensors | `internal/handlers/sensors.go` | Sensor list + history, in-memory simulation |
| Devices | `internal/handlers/devices.go` | Device CRUD, in-memory store |
| Chat | `internal/handlers/chat.go` | Chat history + proxy to LLM (:8001) |
| Users | `internal/handlers/users.go` | Profile management (mock) |
| WebSocket | `internal/handlers/ws.go` | Real-time sensor broadcasting via WS |

### Sensors Handler Lifecycle

- `NewSensorsHandler()` starts a background goroutine (`simulateSensorData`) that generates mock readings every 2 seconds
- `Stop()` method (close on `done` channel) for clean goroutine shutdown in tests
- Readings capped at 1000 per sensor (circular buffer)

### Middleware

- `middleware.go` — JWT generation/validation (`golang-jwt/jwt/v5`) + CORS

### WebSocket

- `/ws` — broadcasts live sensor readings to all connected clients
- Client subscribes to `sensor_updates` room

---

## 5. LLM Service (Python — :8001)

### Stack

- **Framework:** FastAPI
- **Vector DB:** FAISS (local) — `faiss.IndexFlatIP` with cosine similarity
- **LLM:** Ollama (local `llama3` model) with graceful fallback
- **Embeddings:** sentence-transformers (`all-MiniLM-L6-v2`, 384-dim)
- **Fallback:** Keyword-based retrieval + simulated responses when FAISS/Ollama unavailable

### RAG Flow

1. User query → embed with `sentence-transformers` (normalized vectors)
2. FAISS `IndexFlatIP` similarity search over indexed sensor knowledge base
3. Top-k chunks (k=5) → inject into structured prompt
4. Ollama generates response via `POST /api/generate` (temperature=0.3, max_tokens=512)
5. Fallback: If Ollama unreachable or models not installed, keyword search + simulated LLM responses

### Real vs. Fallback Behavior

| Component | When Available | When Unavailable |
|-----------|---------------|-----------------|
| Vector Store | FAISS IndexFlatIP cosine search | Keyword substring matching |
| Embeddings | sentence-transformers (MiniLM-L6-v2) | Basic word overlap scoring |
| LLM | Ollama llama3 via REST API | Hardcoded intelligent response templates |

### Startup

- On `@app.on_startup`: builds FAISS index from sensor knowledge base + simulated statistics
- Health endpoint (`GET /health`) reports: `{ status, version, rag: { chunks_indexed, faiss_enabled } }`
- Ollama health check runs at startup, logs availability

### Endpoints

```
GET  /health              → { status, version, rag }
POST /chat/query          → { question } → { response }
POST /chat/reindex        → rebuild FAISS index → { chunks_indexed }
```

### Files

| File | Purpose |
|------|---------|
| `services/vector_store.py` | FAISS index build/search, fallback retrieval |
| `services/chat_manager.py` | Ollama prompt builder + API call, fallback response generator |
| `services/llm_service.py` | Orchestrator: wires vector search + LLM generation |
| `routers/chat.py` | `/chat/query` and `/chat/reindex` endpoints |
| `main.py` | FastAPI app with startup indexing and health check |

---

## 6. Database (PostgreSQL — :5433)

### Schema

```sql
users (id, username, email, password_hash, created_at)
devices (id, name, type, status, last_seen, user_id)
sensors (id, name, type, unit, device_id)
sensor_readings (id, sensor_id, value, timestamp)
chat_messages (id, user_id, role, content, created_at)
```

### Mock Data

- `generate_mock_data.py` — seeds 5 sensors + historical readings
- Sensor types: voltage (V), amperage (A), power (W)

---

## 7. MQTT

- `mqtt_sensor_publisher.py` — publishes sensor readings every 2 seconds
- Topics: `sensors/+/data` → `{ sensor_id, value, timestamp }`
- Go backend subscribes and writes to PostgreSQL

---

## 8. Deployment

### Cloudflare Tunnel

- `iot.ernstudio.my.id` → frontend (port 5174)
- `api.iot.ernstudio.my.id` → Go backend (port 8002)

### Credentials

| Service | User | Password |
|---------|------|----------|
| Web UI | `admin` | `admin123` |
| PostgreSQL | `jelly` | `jelly1997` |

---

## 9. File Structure

```
/home/radxa/iot-dashboard/
├── AGENTS.md
├── design.md                    ← Design tokens + component spec
├── SPEC.md                     ← This file
├── PRD.md                      ← Product requirements
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/Layout.tsx
│   │   │   └── ui/             ← shadcn components
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── StatisticsPage.tsx
│   │   │   ├── DevicesPage.tsx
│   │   │   ├── ChatbotPage.tsx
│   │   │   └── ProfilePage.tsx
│   │   ├── lib/utils.ts
│   │   ├── index.css           ← Tailwind v4 + @theme tokens
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend-go/
│   ├── main.go
│   ├── internal/
│   │   ├── handlers/          ← auth, sensors, devices, chat, users, ws
│   │   │   └── *_test.go      ← 23 tests (table-driven + httptest)
│   │   ├── middleware/         ← middleware.go (JWT + CORS)
│   │   │   └── middleware_test.go ← 10 tests
│   │   ├── models/
│   │   │   └── models_test.go ← 8 tests
│   │   ├── routes/
│   │   │   └── routes_test.go ← 6 integration tests
│   │   └── config/
│   │       └── config_test.go ← 3 tests
│   └── iot-backend            ← compiled binary
├── backend-python/
│   ├── main.py                 ← FastAPI (startup indexing + health)
│   ├── routers/               ← health, chat (/query, /reindex)
│   ├── services/              ← vector_store, chat_manager, llm_service
│   └── models/schemas.py
├── mqtt_sensor_publisher.py
└── generate_mock_data.py
```