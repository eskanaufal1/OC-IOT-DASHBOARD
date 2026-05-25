package routes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"iot-backend/internal/handlers"
	"iot-backend/internal/middleware"
	"iot-backend/internal/models"
)

func setupTestHandler(t *testing.T) http.Handler {
	t.Helper()

	middleware.JWTSecret = []byte("test-secret")

	authHandler := handlers.NewAuthHandler()
	sensorsHandler := handlers.NewSensorsHandler()
	t.Cleanup(func() { sensorsHandler.Stop() })
	chatHandler := handlers.NewChatHandler("")
	usersHandler := handlers.NewUsersHandler()
	wsHandler := handlers.NewWSHandler(sensorsHandler)

	return Setup(authHandler, sensorsHandler, chatHandler, usersHandler, wsHandler)
}

func TestRoutes_PublicLogin(t *testing.T) {
	srv := httptest.NewServer(setupTestHandler(t))
	defer srv.Close()

	resp, err := http.Post(
		srv.URL+"/api/v1/auth/login",
		"application/json",
		strings.NewReader(`{"username":"admin","password":"admin123"}`),
	)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var loginResp models.LoginResponse
	json.NewDecoder(resp.Body).Decode(&loginResp)
	if loginResp.Token == "" {
		t.Error("expected non-empty token")
	}
}

func TestRoutes_ProtectedWithoutAuth(t *testing.T) {
	srv := httptest.NewServer(setupTestHandler(t))
	defer srv.Close()

	endpoints := []string{
		"/api/v1/sensors",
		"/api/v1/chat/history",
		"/api/v1/users/me",
	}

	for _, ep := range endpoints {
		t.Run(ep, func(t *testing.T) {
			resp, err := http.Get(srv.URL + ep)
			if err != nil {
				t.Fatalf("request: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("%s: status = %d, want %d", ep, resp.StatusCode, http.StatusUnauthorized)
			}
		})
	}
}

func TestRoutes_ProtectedWithAuth(t *testing.T) {
	srv := httptest.NewServer(setupTestHandler(t))
	defer srv.Close()

	resp, _ := http.Post(
		srv.URL+"/api/v1/auth/login",
		"application/json",
		strings.NewReader(`{"username":"admin","password":"admin123"}`),
	)
	var loginResp models.LoginResponse
	json.NewDecoder(resp.Body).Decode(&loginResp)
	resp.Body.Close()

	endpoints := []struct {
		path   string
		method string
	}{
		{"/api/v1/sensors", http.MethodGet},
		{"/api/v1/chat/history", http.MethodGet},
		{"/api/v1/users/me", http.MethodGet},
	}

	for _, ep := range endpoints {
		t.Run(ep.path, func(t *testing.T) {
			req, err := http.NewRequest(ep.method, srv.URL+ep.path, nil)
			if err != nil {
				t.Fatalf("new request: %v", err)
			}
			req.Header.Set("Authorization", "Bearer "+loginResp.Token)

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("request: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("%s %s: status = %d, want %d", ep.method, ep.path, resp.StatusCode, http.StatusOK)
			}
		})
	}
}

func TestRoutes_SensorHistoryEndpoint(t *testing.T) {
	srv := httptest.NewServer(setupTestHandler(t))
	defer srv.Close()

	resp, _ := http.Post(
		srv.URL+"/api/v1/auth/login",
		"application/json",
		strings.NewReader(`{"username":"admin","password":"admin123"}`),
	)
	var loginResp models.LoginResponse
	json.NewDecoder(resp.Body).Decode(&loginResp)
	resp.Body.Close()

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/sensors/1/history", nil)
	req.Header.Set("Authorization", "Bearer "+loginResp.Token)
	resp2, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want %d", resp2.StatusCode, http.StatusOK)
	}
}

func TestRoutes_CORSMiddlewareApplied(t *testing.T) {
	srv := httptest.NewServer(setupTestHandler(t))
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/auth/login")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	origin := resp.Header.Get("Access-Control-Allow-Origin")
	if origin == "" {
		t.Error("CORS headers should be present")
	}
}
