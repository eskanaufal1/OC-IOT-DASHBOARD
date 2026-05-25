package routes

import (
	"net/http"

	"iot-backend/internal/handlers"
	"iot-backend/internal/middleware"
)

func Setup(
	auth *handlers.AuthHandler,
	sensors *handlers.SensorsHandler,
	chat *handlers.ChatHandler,
	users *handlers.UsersHandler,
	ws *handlers.WSHandler,
) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/v1/auth/login", auth.Login)

	protected := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			middleware.AuthMiddleware(http.HandlerFunc(h)).ServeHTTP(w, r)
		}
	}

	mux.HandleFunc("GET /api/v1/sensors", protected(sensors.List))
	mux.HandleFunc("GET /api/v1/sensors/", protected(sensors.History))

	mux.HandleFunc("GET /api/v1/chat/history", protected(chat.History))
	mux.HandleFunc("POST /api/v1/chat/query", protected(chat.Query))
	mux.HandleFunc("GET /api/v1/chat/sessions", protected(chat.Sessions))
	mux.HandleFunc("DELETE /api/v1/chat/sessions/", protected(chat.DeleteSession))
	mux.HandleFunc("GET /api/v1/chat/models", protected(chat.Models))
	mux.HandleFunc("GET /api/v1/chat/model", protected(chat.GetModel))
	mux.HandleFunc("POST /api/v1/chat/model", protected(chat.SwitchModel))

	mux.HandleFunc("GET /api/v1/users/me", protected(users.GetMe))
	mux.HandleFunc("PUT /api/v1/users/me", protected(users.UpdateMe))

	mux.HandleFunc("/ws", ws.HandleWS)

	return middleware.CORSMiddleware(mux)
}
