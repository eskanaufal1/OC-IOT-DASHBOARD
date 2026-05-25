package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"iot-backend/internal/middleware"
	"iot-backend/internal/models"
)

type UsersHandler struct{}

func NewUsersHandler() *UsersHandler {
	return &UsersHandler{}
}

func (h *UsersHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := middleware.GetUserID(r)

	user := models.User{
		ID:        userID,
		Username:  "admin",
		Email:     "admin@iot.local",
		CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	json.NewEncoder(w).Encode(user)
}

func (h *UsersHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := middleware.GetUserID(r)

	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "invalid request body"})
		return
	}

	var update models.UserUpdate
	if err := json.Unmarshal(body, &update); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "invalid request body"})
		return
	}

	user := models.User{
		ID:        userID,
		Username:  "admin",
		Email:     "admin@iot.local",
		CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	if update.Username != nil {
		user.Username = *update.Username
	}
	if update.Email != nil {
		user.Email = *update.Email
	}
	json.NewEncoder(w).Encode(user)
}
