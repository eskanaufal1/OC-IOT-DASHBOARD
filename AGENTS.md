# IoT Dashboard — AGENTS.md

> Context file for AI coding agents (Hermes, OpenCode, Claude Code, Codex).
> Read this before touching any code in `/home/radxa/iot-dashboard/`.

---

## Project Overview

AI-powered IoT monitoring dashboard. Monitors electrical sensors (voltage, amperage, power) via MQTT, visualizes real-time data with Recharts, and provides a RAG-grounded AI chatbot for sensor insights.

**Stack:**
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Recharts
- Backend (Go): REST API + WebSocket, port `:8002`
- LLM Service (Python): RAG chatbot (FAISS + sentence-transformers + Ollama), port `:8001`
- Database: PostgreSQL 13 on port `5433`
- MQTT: Sensor data ingestion
- Tunnel: Cloudflare (iot.ernstudio.my.id / api.iot.ernstudio.my.id)

### RAG System (Python LLM)

- **Vector Store:** ChromaDB (persistent `chroma_data/`) with `all-MiniLM-L6-v2` sentence-transformers embeddings (384-dim)
- **LLM:** llama-cpp-python (direct GGUF model inference — no external server needed)
- **Models:** `backend-python/models/qwen2.5-0.5b-instruct-q8_0.gguf` (644MB, default) and `gemma-3-1b-it-Q8_0.gguf` (1020MB)
- **Fallback:** If ChromaDB or llama-cpp unavailable, gracefully degrades to keyword search + simulated responses
- **Indexing:** Sensor knowledge base chunked into 12 text documents in ChromaDB collection
- **Reindex:** `POST /chat/reindex` endpoint rebuilds the ChromaDB collection
- **Health:** `GET /health` returns RAG status including `chunks_indexed`, `chromadb_enabled`, and active model
- **Model switching:** `GET /chat/models`, `GET /chat/model`, `POST /chat/model` — runtime model selection from chatbot page dropdown

### Testing

- **Go tests:** `go test ./... -v -cover` — 46 tests across 6 packages
  - handlers: 23 tests (auth, sensors, devices, chat, users, websocket)
  - middleware: 10 tests (JWT gen/validation, CORS)
  - models: 8 tests (JSON serialization edge cases)
  - config: 3 tests (defaults + env overrides)
  - routes: 6 integration tests (public/protected/CORS)

---

## Quick Commands

```bash
# === Windows (PowerShell) ===

# Start all 3 services via PM2
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs
pm2 stop all

# === Radxa / Linux ===

# Start all services via PM2
pm2 start ecosystem.config.cjs
pm2 logs
pm2 status
pm2 stop all

# Frontend dev
cd /home/radxa/iot-dashboard/frontend && npm run dev -- --force

# Frontend build check
cd /home/radxa/iot-dashboard/frontend && npm run build

# Go backend
cd /home/radxa/iot-dashboard/backend-go && ./iot-backend
# or: go run main.go

# Go tests
cd /home/radxa/iot-dashboard/backend-go && go test ./... -v -cover

# Python LLM service
cd /home/radxa/iot-dashboard/backend-python && source venv/bin/activate && python main.py

# Install Python RAG dependencies (on Radxa ARM64)
cd /home/radxa/iot-dashboard/backend-python && source venv/bin/activate && pip install -r requirements.txt

# MQTT publisher (sensors)
python /home/radxa/iot-dashboard/mqtt_sensor_publisher.py

# Generate mock sensor data
python /home/radxa/iot-dashboard/generate_mock_data.py
```

**Ports:**
- Frontend: `5174`
- Go API: `8002`
- Python LLM: `8001`
- PostgreSQL: `5433`

---

## Tech Conventions

### shadcn/ui (CRITICAL)

- Components live in `frontend/src/components/ui/`
- Config: `frontend/components.json` — path is `"components": "src/components"` (NO `@` prefix)
- Adding new components: `cd frontend && npx shadcn add <name> --overwrite`
- Fix shadcn paths after fresh install: `src/lib/utils` → `@/lib/utils`, `src/components/ui` → `@/components/ui`
- **DropdownMenuTrigger: NO `render` prop.** Use `asChild` + primitive element (e.g., `<DropdownMenuTrigger asChild><Button>...</Button></DropdownMenuTrigger>`)

### Tailwind v4

- No `tailwind.config.js` — uses `@import "tailwindcss"` + `@theme` in `index.css`
- CSS variables define all tokens (colors, radius, etc.)

### Backend JWT

- Token returned in response: `data.token || data.tokens?.access_token`
- Token stored in `localStorage.getItem('token')`
- Protected routes require `Authorization: Bearer <token>` header

### PostgreSQL

- Host: `192.168.1.100`, port `5433`, database `jelly` (IoT), `iot_dashboard` (separate)
- User: `jelly` / `jelly1997`
- Radxa local PG: port `5433` (NOT default 5432)

---

## Key Pages & Components

| Page | File | Notes |
|------|------|-------|
| Login | `frontend/src/pages/LoginPage.tsx` | JWT auth, shadcn card |
| Dashboard | `frontend/src/pages/DashboardPage.tsx` | KPI cards + chart + devices |
| Statistics | `frontend/src/pages/StatisticsPage.tsx` | Charts for all sensors |
| Devices | `frontend/src/pages/DevicesPage.tsx` | Device management table |
| Chatbot | `frontend/src/pages/ChatbotPage.tsx` | RAG AI assistant |
| Profile | `frontend/src/pages/ProfilePage.tsx` | User settings |

**Layout:** `frontend/src/components/layout/Layout.tsx` — sidebar nav + header, handles mobile.

---

## Design Tokens (PlayStation Dark)

Primary: `#0070d1` | Canvas: `#000` | Surface cards: `#181818` | Success: `#22c55e` | Warning: `#f59e0b` | Destructive: `#ef4444`

See full spec in `design.md` at project root.

---

## Common Pitfalls

1. **Vite hangs** — `npm run dev -- --force` or `rm -rf node_modules/.vite`
2. **MCP browser lsof bug** — `lsof` on empty port returns nil; fix in `~/.npm/_npx/6ddf87659f2ad8a4/.../dist/index.js` append `2>/dev/null || true`
3. **shadcn DropdownMenuTrigger** — no `render` prop in new-york style
4. **Backend JWT token** — key is `data.token` OR `data.tokens?.access_token`, NOT just `data.token`
5. **PostgreSQL port** — radxa uses `5433`, NOT default `5432`

---

## API Endpoints (Go Backend — :8002)

```
POST /api/v1/auth/login          → { token }
GET  /api/v1/sensors             → sensor list
GET  /api/v1/sensors/:id/history → time-series data
GET  /api/v1/devices             → device list
POST /api/v1/devices             → add device
PUT  /api/v1/devices/:id         → update device
DELETE /api/v1/devices/:id       → remove device
GET  /api/v1/chat/history        → chat messages
POST /api/v1/chat/query          → query AI (proxies to :8001)
GET  /api/v1/users/me            → current user
PUT  /api/v1/users/me            → update profile
WS   /ws                          → live sensor updates
```

---

## Database Schema (PostgreSQL)

Tables: `sensors`, `devices`, `sensor_readings`, `chat_messages`, `users`

Key columns:
- `sensors`: `id`, `name`, `type`, `unit`, `device_id`
- `sensor_readings`: `sensor_id`, `value`, `timestamp`
- `devices`: `id`, `name`, `type`, `status`, `last_seen`

---

## Testing the Live Site

- **URL:** https://iot.ernstudio.my.id
- **Login:** `admin` / `admin123`
- Always visually verify with `browser_vision` before reporting completion