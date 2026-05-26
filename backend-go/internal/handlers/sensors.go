package handlers

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"iot-backend/internal/models"
)

type SensorsHandler struct {
	mu         sync.RWMutex
	sensors    []models.Sensor
	readings   map[int][]models.SensorReading
	wsClients  map[chan models.SensorReading]bool
	wsMu       sync.RWMutex
	done       chan struct{}
	mqttOnline     bool
	mqttClient     mqtt.Client
	mqttBroker     string
	lastMQTTOnline time.Time
	recentMsgs     []mqttPayload
	msgMu      sync.Mutex
}

type mqttPayload struct {
	Sensor    string  `json:"sensor"`
	Value     float64 `json:"value"`
	Unit      string  `json:"unit"`
	Timestamp string  `json:"timestamp"`
}

var sensorNameToID = map[string]int{
	"voltage_1": 1, "voltage_2": 2,
	"current_1": 3, "current_2": 4,
	"power_1": 5, "power_2": 6,
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
		mqttOnline: false,
	}

	baseValues := []float64{220.5, 218.7, 4.5, 1.5, 990.0, 330.0}
	rng := rand.New(rand.NewSource(now.UnixNano()))

	for i := range h.sensors {
		val := baseValues[i%len(baseValues)]
		h.sensors[i].LatestValue = &val
		h.sensors[i].LatestTimestamp = &now
	}

	// Backfill 7 days at 60-second intervals — home devices:
	// Circuit 1 = Kulkas (refrigerator), Circuit 2 = LED Smart TV
	historySteps := 7 * 24 * 60
	for step := historySteps; step >= 0; step-- {
		t := now.Add(-time.Duration(step) * 60 * time.Second)
		hour := t.Hour()

		v1 := 220.5 + (rng.Float64()-0.5)*3.0
		v2 := 218.7 + (rng.Float64()-0.5)*3.0

		// Kulkas: compressor cycles 30min, 40% duty
		cyclePos := math.Mod(t.Sub(time.Unix(0, 0)).Seconds(), 1800) / 1800
		var a1 float64
		if cyclePos < 0.40 {
			a1 = 3.5 + rng.Float64()*4.0
			if hour >= 12 && hour <= 16 { a1 += 0.5 }
		} else {
			a1 = 0.1 + rng.Float64()*0.2
		}

		// LED Smart TV: evening on, day standby, night min
		var a2 float64
		if hour >= 18 && hour <= 23 {
			a2 = 1.8 + rng.Float64()*1.2
		} else if hour >= 6 && hour <= 9 {
			a2 = 0.5 + rng.Float64()*0.7
		} else if hour >= 10 && hour <= 17 {
			a2 = 0.1 + rng.Float64()*0.2
		} else {
			a2 = 0.03 + rng.Float64()*0.05
		}

		p1 := v1 * a1
		p2 := v2 * a2

		vals := []float64{
			math.Round(v1*10) / 10, math.Round(v2*10) / 10,
			math.Round(a1*10) / 10, math.Round(a2*10) / 10,
			math.Round(p1*10) / 10, math.Round(p2*10) / 10,
		}
		for i := range h.sensors {
			reading := models.SensorReading{
				SensorID: h.sensors[i].ID,
				Value:    vals[i],
				Timestamp: t,
			}
			h.readings[h.sensors[i].ID] = append(h.readings[h.sensors[i].ID], reading)
		}
	}

	go h.connectMQTT()
	return h
}

func (h *SensorsHandler) connectMQTT() {
	broker := os.Getenv("MQTT_BROKER")
	if broker == "" {
		broker = "localhost"
	}
	port := os.Getenv("MQTT_PORT")
	if port == "" {
		port = "1883"
	}
	h.mu.Lock()
	h.mqttBroker = broker + ":" + port
	h.mu.Unlock()

	opts := mqtt.NewClientOptions().
		AddBroker("tcp://" + broker + ":" + port).
		SetClientID("iot-go-backend").
		SetAutoReconnect(false).
		SetKeepAlive(30 * time.Second).
		SetOnConnectHandler(func(c mqtt.Client) {
			h.mu.Lock()
			h.mqttOnline = true
			h.lastMQTTOnline = time.Now()
			h.mu.Unlock()
			log.Printf("[MQTT] Connected to %s:%s", broker, port)
			c.Subscribe("sensors/#", 1, h.onMQTTMessage)
		}).
		SetConnectionLostHandler(func(c mqtt.Client, err error) {
			h.mu.Lock()
			h.mqttOnline = false
			h.mu.Unlock()
			log.Printf("[MQTT] Connection lost: %v", err)
		})

	client := mqtt.NewClient(opts)
	h.mqttClient = client
	token := client.Connect()
	if token.WaitTimeout(5*time.Second) && token.Error() != nil {
		log.Printf("[MQTT] Failed to connect: %v", token.Error())
		h.mu.Lock()
		h.mqttOnline = false
		h.mu.Unlock()
		return
	}
}

func (h *SensorsHandler) DisconnectMQTT() {
	if h.mqttClient != nil && h.mqttClient.IsConnected() {
		h.mqttClient.Disconnect(500)
		h.mu.Lock()
		h.mqttOnline = false
		h.mu.Unlock()
		log.Printf("[MQTT] Disconnected")
	}
}

func (h *SensorsHandler) ReconnectMQTT() {
	h.DisconnectMQTT()
	go h.connectMQTT()
}

func (h *SensorsHandler) onMQTTMessage(_ mqtt.Client, msg mqtt.Message) {
	var payload mqttPayload
	if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
		log.Printf("[MQTT] Bad payload: %v", err)
		return
	}

	h.msgMu.Lock()
	h.recentMsgs = append(h.recentMsgs, payload)
	if len(h.recentMsgs) > 50 {
		h.recentMsgs = h.recentMsgs[len(h.recentMsgs)-50:]
	}
	h.msgMu.Unlock()

	sensorID, ok := sensorNameToID[payload.Sensor]
	if !ok {
		return
	}

	ts, err := time.Parse(time.RFC3339, payload.Timestamp)
	if err != nil {
		ts = time.Now()
	}

	h.mu.Lock()
	for i := range h.sensors {
		if h.sensors[i].ID == sensorID {
			h.sensors[i].LatestValue = &payload.Value
			h.sensors[i].LatestTimestamp = &ts
			break
		}
	}
	reading := models.SensorReading{
		SensorID:  sensorID,
		Value:     payload.Value,
		Timestamp: ts,
	}
	h.readings[sensorID] = append(h.readings[sensorID], reading)
	if len(h.readings[sensorID]) > 20000 {
		h.readings[sensorID] = h.readings[sensorID][len(h.readings[sensorID])-20000:]
	}
	h.mu.Unlock()

	h.broadcastReading(reading)
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
	ch := make(chan models.SensorReading, 1000)
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
	// Return downsampled: max 2000 points
	if len(readings) > 2000 {
		step := len(readings) / 2000
		sampled := make([]models.SensorReading, 0, 2000)
		for i := 0; i < len(readings); i += step {
			sampled = append(sampled, readings[i])
		}
		if sampled[len(sampled)-1].ID != readings[len(readings)-1].ID {
			sampled = append(sampled, readings[len(readings)-1])
		}
		json.NewEncoder(w).Encode(sampled)
		return
	}
	json.NewEncoder(w).Encode(readings)
}

func (h *SensorsHandler) MQTTOnline() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.mqttOnline
}

func (h *SensorsHandler) MQTTStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	h.msgMu.Lock()
	msgs := make([]mqttPayload, len(h.recentMsgs))
	copy(msgs, h.recentMsgs)
	h.msgMu.Unlock()
	lastActive := ""
	if !h.lastMQTTOnline.IsZero() {
		lastActive = h.lastMQTTOnline.Format(time.RFC3339)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"mqtt_online":  h.MQTTOnline(),
		"broker":       h.mqttBroker,
		"last_active":   lastActive,
		"recent":       msgs,
	})
}

func (h *SensorsHandler) MQTTConnect(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	h.ReconnectMQTT()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"mqtt_online": h.MQTTOnline(),
		"status":      "reconnecting",
	})
}

func (h *SensorsHandler) MQTTDisconnect(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	h.DisconnectMQTT()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"mqtt_online": false,
		"status":      "disconnected",
	})
}
