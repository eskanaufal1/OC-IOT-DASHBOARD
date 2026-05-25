package handlers

import (
	"encoding/json"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"iot-backend/internal/models"
)

type SensorsHandler struct {
	mu        sync.RWMutex
	sensors   []models.Sensor
	readings  map[int][]models.SensorReading
	wsClients map[chan models.SensorReading]bool
	wsMu      sync.RWMutex
	done      chan struct{}
}

func NewSensorsHandler() *SensorsHandler {
	now := time.Now()
	h := &SensorsHandler{
		sensors: []models.Sensor{
			{ID: 1, Name: "Voltage 1", Type: "voltage", Unit: "V"},
			{ID: 2, Name: "Voltage 2", Type: "voltage", Unit: "V"},
			{ID: 3, Name: "Current 1", Type: "amperage", Unit: "A"},
			{ID: 4, Name: "Current 2", Type: "amperage", Unit: "A"},
			{ID: 5, Name: "Power 1", Type: "power", Unit: "W"},
			{ID: 6, Name: "Power 2", Type: "power", Unit: "W"},
		},
		readings:  make(map[int][]models.SensorReading),
		wsClients: make(map[chan models.SensorReading]bool),
		done:      make(chan struct{}),
	}
	mockValues := []float64{220.5, 218.7, 8.5, 5.2, 1874.3, 1137.2}
	for i, s := range h.sensors {
		if i < len(mockValues) {
			val := mockValues[i]
			h.sensors[i].LatestValue = &val
			h.sensors[i].LatestTimestamp = &now
		}
		reading := models.SensorReading{
			SensorID:  s.ID,
			Value:     mockValues[i%len(mockValues)],
			Timestamp: now,
		}
		h.readings[s.ID] = []models.SensorReading{reading}
	}
	go h.simulateSensorData()
	return h
}

func (h *SensorsHandler) simulateSensorData() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	for {
		select {
		case <-h.done:
			return
		case <-ticker.C:
			h.mu.Lock()
			now := time.Now()
			v1 := 220.5 + (rng.Float64()-0.5)*2.0
			v2 := 218.7 + (rng.Float64()-0.5)*2.5
			a1 := 8.5 + (rng.Float64()-0.3)*3.0
			a2 := 5.2 + (rng.Float64()-0.4)*2.0
			a1 = math.Max(a1, 1.0)
			a2 = math.Max(a2, 0.5)
			p1 := math.Round(v1*a1*10) / 10
			p2 := math.Round(v2*a2*10) / 10
			vals := []float64{v1, v2, math.Round(a1*10) / 10, math.Round(a2*10) / 10, p1, p2}
			for i := range h.sensors {
				h.sensors[i].LatestValue = &vals[i]
				h.sensors[i].LatestTimestamp = &now
				reading := models.SensorReading{SensorID: h.sensors[i].ID, Value: vals[i], Timestamp: now}
				h.readings[h.sensors[i].ID] = append(h.readings[h.sensors[i].ID], reading)
				if len(h.readings[h.sensors[i].ID]) > 1000 {
					h.readings[h.sensors[i].ID] = h.readings[h.sensors[i].ID][len(h.readings[h.sensors[i].ID])-1000:]
				}
				h.broadcastReading(reading)
			}
			h.mu.Unlock()
		}
	}
}

func (h *SensorsHandler) Stop() {
	close(h.done)
}

func (h *SensorsHandler) broadcastReading(r models.SensorReading) {
	h.wsMu.RLock()
	defer h.wsMu.RUnlock()
	for ch := range h.wsClients {
		select {
		case ch <- r:
		default:
		}
	}
}

func (h *SensorsHandler) Subscribe() chan models.SensorReading {
	ch := make(chan models.SensorReading, 100)
	h.wsMu.Lock()
	h.wsClients[ch] = true
	h.wsMu.Unlock()
	return ch
}

func (h *SensorsHandler) Unsubscribe(ch chan models.SensorReading) {
	h.wsMu.Lock()
	delete(h.wsClients, ch)
	close(ch)
	h.wsMu.Unlock()
}

func (h *SensorsHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	h.mu.RLock()
	defer h.mu.RUnlock()
	sensors := make([]models.Sensor, len(h.sensors))
	copy(sensors, h.sensors)
	json.NewEncoder(w).Encode(sensors)
}

func (h *SensorsHandler) History(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/sensors/")
	path = strings.TrimSuffix(path, "/history")
	id, err := strconv.Atoi(path)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.APIResponse{Error: "invalid sensor ID"})
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	readings, ok := h.readings[id]
	if !ok {
		json.NewEncoder(w).Encode([]models.SensorReading{})
		return
	}
	json.NewEncoder(w).Encode(readings)
}
