package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"iot-backend/internal/middleware"
	"iot-backend/internal/models"
)

var mockUsers = map[string]string{
	"admin": "admin123",
}

type AuthHandler struct{}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "invalid request body"})
		return
	}

	var req models.LoginRequest
	if err := json.Unmarshal(body, &req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "invalid request body"})
		return
	}

	expectedPass, ok := mockUsers[req.Username]
	if !ok || expectedPass != req.Password {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "invalid credentials"})
		return
	}

	token, err := middleware.GenerateToken(1, req.Username)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "failed to generate token"})
		return
	}

	json.NewEncoder(w).Encode(models.LoginResponse{Token: token})
}
