package main

import (
	"log"
	"net/http"

	"iot-backend/internal/config"
	"iot-backend/internal/handlers"
	"iot-backend/internal/middleware"
	"iot-backend/internal/routes"
)

func main() {
	cfg := config.Load()

	middleware.JWTSecret = []byte(cfg.JWTSecret)

	authHandler := handlers.NewAuthHandler()
	sensorsHandler := handlers.NewSensorsHandler()
	chatHandler := handlers.NewChatHandler(cfg.LLMURL)
	usersHandler := handlers.NewUsersHandler()
	wsHandler := handlers.NewWSHandler(sensorsHandler)

	handler := routes.Setup(
		authHandler,
		sensorsHandler,
		chatHandler,
		usersHandler,
		wsHandler,
	)

	log.Printf("IoT Backend starting on port %s", cfg.Port)
	log.Printf("API: http://localhost:%s/api/v1", cfg.Port)
	log.Printf("WebSocket: ws://localhost:%s/ws", cfg.Port)

	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
