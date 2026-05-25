package models

import (
	"encoding/json"
	"testing"
	"time"
)

func TestUser_JSONSerialization(t *testing.T) {
	user := User{
		ID:           1,
		Username:     "admin",
		Email:        "admin@iot.local",
		PasswordHash: "secret-hash",
		CreatedAt:    time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}

	data, err := json.Marshal(user)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var result map[string]interface{}
	json.Unmarshal(data, &result)

	if _, exists := result["password_hash"]; exists {
		t.Error("password_hash should not be in JSON output (json:\"-\")")
	}
	if result["username"] != "admin" {
		t.Errorf("username = %v, want admin", result["username"])
	}
}

func TestUser_JSONRoundtrip(t *testing.T) {
	user := User{
		ID:        1,
		Username:  "admin",
		Email:     "admin@iot.local",
		CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}

	data, _ := json.Marshal(user)
	var restored User
	json.Unmarshal(data, &restored)

	if restored.Username != user.Username {
		t.Errorf("username mismatch: %q vs %q", restored.Username, user.Username)
	}
	if restored.Email != user.Email {
		t.Errorf("email mismatch: %q vs %q", restored.Email, user.Email)
	}
	if restored.PasswordHash != "" {
		t.Error("password_hash should be empty after unmarshal")
	}
}

func TestLoginResponse_JSON(t *testing.T) {
	resp := LoginResponse{Token: "test-token-123"}
	data, _ := json.Marshal(resp)

	var result map[string]interface{}
	json.Unmarshal(data, &result)
	if result["token"] != "test-token-123" {
		t.Errorf("token = %v", result["token"])
	}
}

func TestAPIResponse_Data(t *testing.T) {
	resp := APIResponse{Data: map[string]string{"key": "value"}}
	data, _ := json.Marshal(resp)

	var result map[string]interface{}
	json.Unmarshal(data, &result)
	if _, exists := result["error"]; exists {
		t.Error("error key should not exist when only data is set")
	}
	if result["data"] == nil {
		t.Error("data key should exist")
	}
}

func TestAPIResponse_Error(t *testing.T) {
	resp := APIResponse{Error: "something failed"}
	data, _ := json.Marshal(resp)

	var result map[string]interface{}
	json.Unmarshal(data, &result)
	if result["error"] != "something failed" {
		t.Errorf("error = %v", result["error"])
	}
}

func TestSensor_Types(t *testing.T) {
	val := 220.5
	now := time.Now()
	s := Sensor{
		ID:              1,
		Name:            "Voltage 1",
		Type:            "voltage",
		Unit:            "V",
		LatestValue:     &val,
		LatestTimestamp: &now,
	}

	data, _ := json.Marshal(s)
	var parsed map[string]interface{}
	json.Unmarshal(data, &parsed)

	if parsed["latest_value"] != 220.5 {
		t.Errorf("latest_value = %v", parsed["latest_value"])
	}
	if parsed["latest_timestamp"] == nil {
		t.Error("latest_timestamp should not be null")
	}
	if _, exists := parsed["device_id"]; exists {
		t.Error("device_id should not exist in JSON output")
	}
}

func TestChatMessage_Roles(t *testing.T) {
	msg := ChatMessage{
		ID:     1,
		UserID: 1,
		Role:   "user",
		Content: "Hello",
	}

	if msg.Role != "user" && msg.Role != "assistant" {
		t.Errorf("invalid role: %q", msg.Role)
	}
}
