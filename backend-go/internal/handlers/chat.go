package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"

	"iot-backend/internal/middleware"
	"iot-backend/internal/models"
)

type ChatHandler struct {
	mu       sync.RWMutex
	messages []models.ChatMessage
	nextID   int
	llmURL   string
}

func NewChatHandler(llmURL string) *ChatHandler {
	return &ChatHandler{
		messages: []models.ChatMessage{},
		nextID:   1,
		llmURL:   llmURL,
	}
}

func (h *ChatHandler) History(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.llmURL == "" {
		userID := middleware.GetUserID(r)
		h.mu.RLock()
		defer h.mu.RUnlock()
		var msgs []models.ChatMessage
		for _, msg := range h.messages {
			if msg.UserID == userID {
				msgs = append(msgs, msg)
			}
		}
		if msgs == nil {
			msgs = []models.ChatMessage{}
		}
		json.NewEncoder(w).Encode(msgs)
		return
	}
	path := "/chat/history"
	if r.URL.RawQuery != "" {
		path += "?" + r.URL.RawQuery
	}
	h.proxyLLM(w, r, path, http.MethodGet)
}

func (h *ChatHandler) Query(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := middleware.GetUserID(r)

	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "invalid request body"})
		return
	}

	var query models.ChatQuery
	if err := json.Unmarshal(body, &query); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "invalid request body"})
		return
	}

	h.mu.Lock()
	userMsg := models.ChatMessage{
		ID:        h.nextID,
		UserID:    userID,
		SessionID: query.SessionID,
		Role:      "user",
		Content:   query.Question,
	}
	h.nextID++
	h.messages = append(h.messages, userMsg)
	h.mu.Unlock()

	var response string
	var sessionID string
	var title string

	if h.llmURL != "" {
		sessionID, title, response = h.queryLLMWithSession(query.Question, query.SessionID, userID)
	} else {
		response = h.fallbackResponse(query.Question)
		sessionID = query.SessionID
	}

	h.mu.Lock()
	assistantMsg := models.ChatMessage{
		ID:        h.nextID,
		UserID:    userID,
		SessionID: sessionID,
		Role:      "assistant",
		Content:   response,
	}
	h.nextID++
	h.messages = append(h.messages, assistantMsg)
	h.mu.Unlock()

	json.NewEncoder(w).Encode(models.ChatResponse{
		Response:  response,
		SessionID: sessionID,
		Title:     title,
	})
}

func (h *ChatHandler) queryLLMWithSession(question, sessionID string, userID int) (string, string, string) {
	payload, _ := json.Marshal(map[string]interface{}{
		"question":   question,
		"session_id": sessionID,
		"user_id":    userID,
	})
	resp, err := http.Post(h.llmURL+"/chat/query", "application/json", bytes.NewReader(payload))
	if err != nil {
		return "", sessionID, "I'm unable to reach the AI service right now. Please try again."
	}
	defer resp.Body.Close()

	var result models.ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", sessionID, "Received an invalid response from the AI service."
	}

	return result.SessionID, result.Title, result.Response
}

func (h *ChatHandler) fallbackResponse(question string) string {
	lower := strings.ToLower(question)
	if strings.Contains(lower, "hello") || strings.Contains(lower, "hi ") || strings.Contains(lower, "hey") {
		return "Hello! I'm Sensor AI. The LLM service is not running, but I can still answer basic questions about your sensors: Voltage 1 & 2, Current 1 & 2, and Power 1 & 2."
	}
	return "The AI service is currently unavailable. Please start the Python LLM service on port 8001 to enable intelligent responses."
}

func (h *ChatHandler) Sessions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.llmURL == "" {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "LLM service not configured"})
		return
	}
	h.proxyLLM(w, r, "/chat/sessions", http.MethodGet)
}

func (h *ChatHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.llmURL == "" {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "LLM service not configured"})
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/chat/sessions/")
	h.proxyLLM(w, r, "/chat/sessions/"+path, http.MethodDelete)
}

func (h *ChatHandler) Models(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	h.proxyLLM(w, r, "/chat/models", http.MethodGet)
}

func (h *ChatHandler) GetModel(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	h.proxyLLM(w, r, "/chat/model", http.MethodGet)
}

func (h *ChatHandler) SwitchModel(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	h.proxyLLM(w, r, "/chat/model", http.MethodPost)
}

func (h *ChatHandler) proxyLLM(w http.ResponseWriter, r *http.Request, path string, method string) {
	if h.llmURL == "" {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "LLM service not configured"})
		return
	}

	var body io.Reader
	if method == http.MethodPost || method == http.MethodDelete {
		body = r.Body
	}

	req, err := http.NewRequest(method, h.llmURL+path, body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "failed to create proxy request"})
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "LLM service unreachable"})
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
