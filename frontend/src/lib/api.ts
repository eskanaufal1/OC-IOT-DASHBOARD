const API_BASE = "/api/v1"

function getToken(): string | null {
  return localStorage.getItem("token")
}

export function setToken(token: string) {
  localStorage.setItem("token", token)
}

export function clearToken() {
  localStorage.removeItem("token")
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    clearToken()
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message || "Request failed")
  }

  return res.json()
}

export interface User {
  id: number
  username: string
  email: string
  created_at: string
}

export interface Sensor {
  id: number
  name: string
  type: string
  unit: string
  latest_value?: number
  latest_timestamp?: string
}

export interface SensorReading {
  sensor_id: number
  value: number
  timestamp: string
}

export interface ChatMessage {
  id: number
  user_id: number
  session_id?: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

export interface ChatSession {
  id: string
  title: string
  message_count: number
  created_at: string
  updated_at: string
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Login failed" }))
    throw new Error(err.message || "Login failed")
  }
  const data = await res.json()
  const token = data.token || data.tokens?.access_token
  if (!token) throw new Error("No token in response")
  setToken(token)
  return token
}

export async function fetchSensors(): Promise<Sensor[]> {
  return apiFetch("/sensors")
}

export async function fetchSensorHistory(sensorId: number): Promise<SensorReading[]> {
  return apiFetch(`/sensors/${sensorId}/history`)
}

export async function fetchChatSessions(): Promise<ChatSession[]> {
  return apiFetch("/chat/sessions")
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  return apiFetch(`/chat/sessions/${sessionId}`, { method: "DELETE" })
}

export async function fetchChatHistory(sessionId?: string): Promise<ChatMessage[]> {
  const ep = sessionId ? `/chat/history?session_id=${sessionId}` : "/chat/history"
  return apiFetch(ep)
}

export async function sendChatQuery(question: string, sessionId?: string): Promise<{ response: string; session_id?: string; title?: string }> {
  return apiFetch("/chat/query", { method: "POST", body: JSON.stringify({ question, session_id: sessionId || "" }) })
}

export async function fetchModels(): Promise<{ models: Array<{ name: string; filename: string; size_mb: number }>; active: string; loaded: boolean }> {
  return apiFetch("/chat/models")
}

export async function fetchActiveModel(): Promise<{ model: string; loaded: boolean }> {
  return apiFetch("/chat/model")
}

export async function switchModel(modelName: string): Promise<{ model: string; loaded: boolean }> {
  return apiFetch("/chat/model", { method: "POST", body: JSON.stringify({ model: modelName }) })
}

export async function fetchCurrentUser(): Promise<User> {
  return apiFetch("/users/me")
}

export async function updateUserProfile(data: Partial<User>): Promise<User> {
  return apiFetch("/users/me", { method: "PUT", body: JSON.stringify(data) })
}
