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

func TestUsersHandler_GetMe(t *testing.T) {
	handler := NewUsersHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, 1)
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	handler.GetMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var user models.User
	if err := json.Unmarshal(rec.Body.Bytes(), &user); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if user.Username != "admin" {
		t.Errorf("username = %q, want admin", user.Username)
	}
	if user.Email != "admin@iot.local" {
		t.Errorf("email = %q, want admin@iot.local", user.Email)
	}
	if user.ID != 1 {
		t.Errorf("id = %d, want 1", user.ID)
	}
}

func TestUsersHandler_UpdateMe(t *testing.T) {
	handler := NewUsersHandler()

	t.Run("update username", func(t *testing.T) {
		body := `{"username":"newadmin"}`
		req := httptest.NewRequest(http.MethodPut, "/api/v1/users/me", bytes.NewReader([]byte(body)))
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, 1)
		req = req.WithContext(ctx)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.UpdateMe(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		var user models.User
		json.Unmarshal(rec.Body.Bytes(), &user)
		if user.Username != "newadmin" {
			t.Errorf("username = %q, want newadmin", user.Username)
		}
	})

	t.Run("update email", func(t *testing.T) {
		body := `{"email":"new@iot.local"}`
		req := httptest.NewRequest(http.MethodPut, "/api/v1/users/me", bytes.NewReader([]byte(body)))
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, 2)
		req = req.WithContext(ctx)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.UpdateMe(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		var user models.User
		json.Unmarshal(rec.Body.Bytes(), &user)
		if user.Email != "new@iot.local" {
			t.Errorf("email = %q, want new@iot.local", user.Email)
		}
		if user.ID != 2 {
			t.Errorf("id = %d, want 2", user.ID)
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/api/v1/users/me", bytes.NewReader([]byte(`{bad}`)))
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, 1)
		req = req.WithContext(ctx)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.UpdateMe(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
	})
}

func TestUsersHandler_GetMeUserIDContext(t *testing.T) {
	handler := NewUsersHandler()

	tests := []struct {
		userID int
	}{
		{1}, {42}, {999},
	}

	for _, tt := range tests {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, tt.userID)
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()
		handler.GetMe(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("userID=%d: status = %d", tt.userID, rec.Code)
			continue
		}

		var user models.User
		json.Unmarshal(rec.Body.Bytes(), &user)
		if user.ID != tt.userID {
			t.Errorf("userID=%d: response id = %d", tt.userID, user.ID)
		}
	}
}
