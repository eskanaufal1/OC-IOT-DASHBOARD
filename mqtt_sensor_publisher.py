#!/usr/bin/env python3
"""
MQTT Sensor Publisher — publishes mock sensor readings to local MQTT broker.
Topic format: sensors/{sensor_name}/data
Payload: { "sensor_id": 1, "value": 220.5, "timestamp": "2024-..." }
"""

import json
import time
import random
import threading
from datetime import datetime, timezone

MQTT_AVAILABLE = False
try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    print("[WARN] paho-mqtt not installed. Run: pip install paho-mqtt")
    print("[INFO] Running in simulation mode (no MQTT broker needed)")

BROKER = "localhost"
PORT = 1883
TOPIC_PREFIX = "sensors"

SENSORS = [
    {"id": 1, "name": "main_voltage", "base": 220.0, "noise": 2.0},
    {"id": 2, "name": "main_amperage", "base": 15.0, "noise": 3.0},
    {"id": 3, "name": "total_power", "base": 3300.0, "noise": 500.0},
    {"id": 4, "name": "temperature", "base": 28.0, "noise": 1.5},
    {"id": 5, "name": "humidity", "base": 65.0, "noise": 5.0},
]


def generate_reading(sensor):
    value = sensor["base"] + random.uniform(-sensor["noise"], sensor["noise"])
    return {
        "sensor_id": sensor["id"],
        "value": round(value, 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def simulate_publish():
    while True:
        for sensor in SENSORS:
            reading = generate_reading(sensor)
            topic = f"{TOPIC_PREFIX}/{sensor['name']}/data"
            print(f"[SIM] {topic} → {json.dumps(reading)}")
        time.sleep(2)


def mqtt_publish(client):
    while True:
        for sensor in SENSORS:
            reading = generate_reading(sensor)
            topic = f"{TOPIC_PREFIX}/{sensor['name']}/data"
            payload = json.dumps(reading)
            client.publish(topic, payload)
            print(f"[MQTT] {topic} → {payload}")
        time.sleep(2)


def main():
    if not MQTT_AVAILABLE:
        print("Starting MQTT sensor publisher (simulation mode)...")
        simulate_publish()
        return

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.username_pw_set("jelly", "jelly1997")

    try:
        client.connect(BROKER, PORT, 60)
        print(f"Connected to MQTT broker at {BROKER}:{PORT}")
        mqtt_publish(client)
    except Exception as e:
        print(f"Failed to connect to MQTT broker: {e}")
        print("Falling back to simulation mode...")
        simulate_publish()


if __name__ == "__main__":
    main()
