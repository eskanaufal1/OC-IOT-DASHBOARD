package models

import "time"

type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
}

type Sensor struct {
	ID              int        `json:"id"`
	Name            string     `json:"name"`
	Type            string     `json:"type"`
	Unit            string     `json:"unit"`
	LatestValue     *float64   `json:"latest_value"`
	LatestTimestamp *time.Time `json:"latest_timestamp"`
}

type SensorReading struct {
	ID        int       `json:"id"`
	SensorID  int       `json:"sensor_id"`
	Value     float64   `json:"value"`
	Timestamp time.Time `json:"timestamp"`
}

type ChatMessage struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	SessionID string    `json:"session_id,omitempty"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type ChatSession struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	MessageCount int    `json:"message_count"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type ChatQuery struct {
	Question  string `json:"question"`
	SessionID string `json:"session_id,omitempty"`
}

type ChatResponse struct {
	Response  string `json:"response"`
	SessionID string `json:"session_id,omitempty"`
	Title     string `json:"title,omitempty"`
}

type UserUpdate struct {
	Username *string `json:"username,omitempty"`
	Email    *string `json:"email,omitempty"`
	Password *string `json:"password,omitempty"`
}

type APIResponse struct {
	Data  interface{} `json:"data,omitempty"`
	Error string      `json:"error,omitempty"`
}
