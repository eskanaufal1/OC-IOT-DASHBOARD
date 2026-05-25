package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"iot-backend/internal/models"
)

func TestWSHandler_Connect(t *testing.T) {
	sensorsHandler := NewSensorsHandler()
	defer sensorsHandler.Stop()

	time.Sleep(100 * time.Millisecond)

	handler := NewWSHandler(sensorsHandler)
	srv := httptest.NewServer(http.HandlerFunc(handler.HandleWS))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v (expected broadcast within 5s)", err)
	}

	var resp models.APIResponse
	if err := json.Unmarshal(msg, &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Data == nil {
		t.Error("expected data in response")
	}
}

func TestWSHandler_MultipleClients(t *testing.T) {
	sensorsHandler := NewSensorsHandler()
	defer sensorsHandler.Stop()

	time.Sleep(100 * time.Millisecond)

	handler := NewWSHandler(sensorsHandler)
	srv := httptest.NewServer(http.HandlerFunc(handler.HandleWS))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"

	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial conn1: %v", err)
	}
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial conn2: %v", err)
	}
	defer conn2.Close()

	conn1.SetReadDeadline(time.Now().Add(5 * time.Second))
	conn2.SetReadDeadline(time.Now().Add(5 * time.Second))

	_, msg1, err1 := conn1.ReadMessage()
	_, msg2, err2 := conn2.ReadMessage()

	if err1 != nil {
		t.Errorf("conn1 read: %v", err1)
	}
	if err2 != nil {
		t.Errorf("conn2 read: %v", err2)
	}
	if string(msg1) == "" || string(msg2) == "" {
		t.Error("both clients should receive data")
	}
}
