package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"iot-backend/internal/middleware"
	"iot-backend/internal/models"
)

func TestChatHandler_History(t *testing.T) {
	handler := NewChatHandler("")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/history", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, 1)
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	handler.History(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var messages []models.ChatMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &messages); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(messages) != 0 {
		t.Errorf("message count = %d, want 0", len(messages))
	}
}

func TestChatHandler_Query(t *testing.T) {
	handler := NewChatHandler("")

	t.Run("valid query", func(t *testing.T) {
		body := `{"question":"What is the voltage?"}`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/query", bytes.NewReader([]byte(body)))
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, 1)
		req = req.WithContext(ctx)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.Query(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
		}

		var resp models.ChatResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if resp.Response == "" {
			t.Error("expected non-empty response")
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/query", bytes.NewReader([]byte(`{bad}`)))
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, 1)
		req = req.WithContext(ctx)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.Query(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
	})
}

func TestChatHandler_HistoryAfterQuery(t *testing.T) {
	handler := NewChatHandler("")

	queryReq := httptest.NewRequest(http.MethodPost, "/api/v1/chat/query",
		bytes.NewReader([]byte(`{"question":"Hello"}`)))
	ctx := context.WithValue(queryReq.Context(), middleware.UserIDKey, 1)
	queryReq = queryReq.WithContext(ctx)
	queryReq.Header.Set("Content-Type", "application/json")
	queryRec := httptest.NewRecorder()
	handler.Query(queryRec, queryReq)

	if queryRec.Code != http.StatusOK {
		t.Fatalf("query failed: %d", queryRec.Code)
	}

	histReq := httptest.NewRequest(http.MethodGet, "/api/v1/chat/history", nil)
	histReq = histReq.WithContext(context.WithValue(histReq.Context(), middleware.UserIDKey, 1))
	histRec := httptest.NewRecorder()
	handler.History(histRec, histReq)

	var messages []models.ChatMessage
	json.Unmarshal(histRec.Body.Bytes(), &messages)

	if len(messages) != 2 {
		t.Errorf("message count = %d, want 2", len(messages))
	}
	if len(messages) == 2 {
		if messages[0].Role != "user" {
			t.Errorf("first message role = %q, want user", messages[0].Role)
		}
		if messages[1].Role != "assistant" {
			t.Errorf("second message role = %q, want assistant", messages[1].Role)
		}
	}
}

func TestChatHandler_LLMFallback(t *testing.T) {
	handler := NewChatHandler("")

	body := `{"question":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/query", bytes.NewReader([]byte(body)))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, 1)
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Query(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp models.ChatResponse
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.Response == "" {
		t.Error("expected fallback response")
	}
}

func TestChatHandler_UserScopedHistory(t *testing.T) {
	handler := NewChatHandler("")

	body := `{"question":"test"}`
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/chat/query", bytes.NewReader([]byte(body)))
	ctx1 := context.WithValue(req1.Context(), middleware.UserIDKey, 1)
	req1 = req1.WithContext(ctx1)
	req1.Header.Set("Content-Type", "application/json")
	rec1 := httptest.NewRecorder()
	handler.Query(rec1, req1)

	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/chat/query", bytes.NewReader([]byte(body)))
	ctx2 := context.WithValue(req2.Context(), middleware.UserIDKey, 2)
	req2 = req2.WithContext(ctx2)
	req2.Header.Set("Content-Type", "application/json")
	rec2 := httptest.NewRecorder()
	handler.Query(rec2, req2)

	histReq := httptest.NewRequest(http.MethodGet, "/api/v1/chat/history", nil)
	histReq = histReq.WithContext(context.WithValue(histReq.Context(), middleware.UserIDKey, 1))
	histRec := httptest.NewRecorder()
	handler.History(histRec, histReq)

	var messages []models.ChatMessage
	json.Unmarshal(histRec.Body.Bytes(), &messages)

	if len(messages) != 2 {
		t.Errorf("user 1 message count = %d, want 2 (should not see user 2's messages)", len(messages))
	}
}
