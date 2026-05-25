package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"

	"iot-backend/internal/models"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WSHandler struct {
	sensorsHandler *SensorsHandler
}

func NewWSHandler(sensorsHandler *SensorsHandler) *WSHandler {
	return &WSHandler{sensorsHandler: sensorsHandler}
}

func (h *WSHandler) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	ch := h.sensorsHandler.Subscribe()
	defer h.sensorsHandler.Unsubscribe(ch)

	for reading := range ch {
		data, err := json.Marshal(models.APIResponse{Data: reading})
		if err != nil {
			continue
		}
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			break
		}
	}
}
