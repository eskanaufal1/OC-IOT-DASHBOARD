package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"iot-backend/internal/models"
)

func TestSensorsHandler_List(t *testing.T) {
	handler := NewSensorsHandler()
	defer handler.Stop()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sensors", nil)
	rec := httptest.NewRecorder()
	handler.List(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var sensors []models.Sensor
	if err := json.Unmarshal(rec.Body.Bytes(), &sensors); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(sensors) != 6 {
		t.Errorf("sensor count = %d, want 6", len(sensors))
	}

	expectedNames := []string{"Voltage 1", "Voltage 2", "Current 1", "Current 2", "Power 1", "Power 2"}
	for i, name := range expectedNames {
		if i >= len(sensors) {
			break
		}
		if sensors[i].Name != name {
			t.Errorf("sensor[%d].Name = %q, want %q", i, sensors[i].Name, name)
		}
	}

	for _, s := range sensors {
		if s.LatestValue == nil {
			t.Errorf("sensor %q has nil LatestValue", s.Name)
		}
	}
}

func TestSensorsHandler_History(t *testing.T) {
	handler := NewSensorsHandler()
	defer handler.Stop()

	tests := []struct {
		name       string
		path       string
		wantStatus int
	}{
		{"existing sensor", "/api/v1/sensors/1/history", http.StatusOK},
		{"nonexistent sensor", "/api/v1/sensors/999/history", http.StatusOK},
		{"invalid ID", "/api/v1/sensors/abc/history", http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()
			handler.History(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}

			if rec.Code == http.StatusOK {
				var readings []models.SensorReading
				if err := json.Unmarshal(rec.Body.Bytes(), &readings); err != nil {
					t.Errorf("unmarshal: %v", err)
				}
			}
		})
	}
}

func TestSensorsHandler_DataIntegrity(t *testing.T) {
	handler := NewSensorsHandler()
	defer handler.Stop()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sensors", nil)
	rec := httptest.NewRecorder()
	handler.List(rec, req)

	var sensors []models.Sensor
	json.Unmarshal(rec.Body.Bytes(), &sensors)

	if len(sensors) != 6 {
		t.Fatalf("sensor count = %d, want 6", len(sensors))
	}

	for _, s := range sensors {
		if s.ID <= 0 {
			t.Errorf("sensor %s has invalid ID %d", s.Name, s.ID)
		}
		if s.Name == "" {
			t.Error("sensor has empty name")
		}
		if s.Type == "" {
			t.Error("sensor has empty type")
		}
		if s.Unit == "" {
			t.Error("sensor has empty unit")
		}
	}
}
