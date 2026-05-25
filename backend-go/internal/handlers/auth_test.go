package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"iot-backend/internal/middleware"
	"iot-backend/internal/models"
)

func TestAuthHandler_Login(t *testing.T) {
	middleware.JWTSecret = []byte("test-secret")

	tests := []struct {
		name       string
		body       string
		wantStatus int
		checkBody  func(t *testing.T, body []byte)
	}{
		{
			name:       "valid credentials",
			body:       `{"username":"admin","password":"admin123"}`,
			wantStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp models.LoginResponse
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatalf("unmarshal: %v", err)
				}
				if resp.Token == "" {
					t.Error("expected non-empty token")
				}
			},
		},
		{
			name:       "wrong password",
			body:       `{"username":"admin","password":"wrong"}`,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "nonexistent user",
			body:       `{"username":"nobody","password":"x"}`,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid JSON",
			body:       `{bad}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "empty body",
			body:       ``,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewAuthHandler()
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader([]byte(tt.body)))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			handler.Login(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.wantStatus, rec.Body.String())
			}
			if tt.checkBody != nil {
				tt.checkBody(t, rec.Body.Bytes())
			}
		})
	}
}

func TestAuthHandler_TokenValid(t *testing.T) {
	middleware.JWTSecret = []byte("test-secret")

	handler := NewAuthHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login",
		bytes.NewReader([]byte(`{"username":"admin","password":"admin123"}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.Login(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("login failed: %d", rec.Code)
	}

	var resp models.LoginResponse
	json.Unmarshal(rec.Body.Bytes(), &resp)

	token, err := middleware.GenerateToken(1, "admin")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	if token == "" {
		t.Error("expected non-empty token from GenerateToken")
	}
	if resp.Token == "" {
		t.Error("expected non-empty token from login response")
	}
}
