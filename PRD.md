# IoT Dashboard — PRD

> Product Requirements Document. Describes why we build, who it's for, and what success looks like.

---

## 1. Vision & Goals

An **AI-powered IoT monitoring dashboard** for home/lab electrical infrastructure. It gives Jelly a single pane of glass to:
- Monitor real-time sensor readings (voltage, amperage, power) across multiple circuits
- View historical trends to detect anomalies and plan capacity
- Manage connected devices (add, toggle, remove)
- Ask plain-language questions about sensor data via an AI chatbot

**Core principle:** Data should be glanceable in 3 seconds, drillable in 2 clicks.

---

## 2. Target User

**Primary:** Jelly (admin) — self-hosted home/lab IoT environment.

**Use cases:**
- Morning check: "anything offline?" → glance dashboard
- Anomaly investigation: "why did power spike at 3am?" → statistics page
- Device management: "add new temperature sensor" → devices page
- Natural-language query: "which sensor has been most unstable this week?" → chatbot

---

## 3. Feature List

### Dashboard
- [x] KPI cards — 5 sensor readings with live values, trend badges, status dots
- [x] Live area chart — 1h/6h/24h/7d time range selector
- [x] Device status table — online/offline/warning per device
- [x] WebSocket-driven real-time updates (no refresh needed)

### Statistics
- [x] Summary stat cards — avg, min, max, latest per sensor
- [x] Multi-chart grid — temperature, humidity, pressure views
- [x] Date range selection for historical analysis

### Devices
- [x] Device list with type, status, last-seen
- [x] Add device form (name, type, sensors)
- [x] Edit / delete device
- [x] Power toggle per device

### Chatbot
- [x] Message history (user + assistant)
- [x] RAG-grounded responses from FAISS vector store + Ollama LLM
- [x] Graceful fallback: keyword search + simulated responses when offline
- [x] Streaming-style UX (typing indicator)
- [x] `/chat/reindex` endpoint for manual index rebuild

### Profile
- [x] View/edit username, email
- [x] Change password
- [x] Activity stats

### Auth
- [x] JWT login — admin / admin123
- [x] Protected routes — redirect to login if unauthenticated
- [x] Token stored in localStorage

---

## 4. Design Direction

**Aesthetic:** PlayStation System UI — dark-first, hardware-inspired, professional.

- Primary: `#0070d1` (Sony blue)
- Canvas: `#000000` (true black)
- Surface cards: `#181818` (elevated dark)
- Pill-shaped primary buttons
- Minimal borders, subtle surface elevation over shadow

See `design.md` for full component specs.

---

## 5. Non-Goals (Out of Scope)

- Multi-user / team support (single admin only for now)
- Native mobile app
- Native MQTT device provisioning (devices added via UI manually)
- Push notifications
- Data export

---

## 6. Success Metrics

| Metric | How Measured |
|--------|-------------|
| Dashboard load | < 2s on local network |
| Real-time updates | < 1s latency from MQTT publish to UI |
| Chatbot response | < 5s (RAG + local Ollama) |
| Uptime | 99%+ (self-hosted) |

---

## 7. Open Questions

- [ ] Should chat history persist across sessions? (currently: yes, in PostgreSQL)
- [ ] Do we need alert thresholds with notifications? (not yet implemented)
- [ ] MQTT broker authentication? (currently open)

---

## 8. Tech Constraints

- **Self-hosted** on radxa (ARM64, local network)
- **No cloud** — all services run locally
- **LLM** must work offline — Ollama + local model
- **PostgreSQL** only — no MongoDB, no Redis
- **No WebSocket library** — Go native gorilla/websocket or similar