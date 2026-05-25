"""
MQTT Sensor Publisher — publishes 6 sensor readings every 60 seconds via Mosquitto.
Realistic daily load patterns with morning/evening peaks.
"""
import json
import math
import os
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

BROKER = os.getenv("MQTT_BROKER", "localhost")
PORT = int(os.getenv("MQTT_PORT", "1883"))
INTERVAL = int(os.getenv("PUBLISH_INTERVAL", "60"))

TOPICS = {
    "voltage_1": "sensors/voltage_1",
    "voltage_2": "sensors/voltage_2",
    "current_1": "sensors/current_1",
    "current_2": "sensors/current_2",
    "power_1":   "sensors/power_1",
    "power_2":   "sensors/power_2",
}

UNITS = {
    "voltage_1": "V", "voltage_2": "V",
    "current_1": "A", "current_2": "A",
    "power_1": "W", "power_2": "W",
}

def hour_factor(hour: int) -> float:
    """Daily load pattern: peak 06-09 and 18-22, dip 00-05."""
    if 6 <= hour <= 9:   return 1.35
    if 18 <= hour <= 22: return 1.20
    if 0 <= hour <= 5:   return 0.50
    return 1.0


def generate_reading(sensor: str, t: float) -> float:
    dt = datetime.fromtimestamp(t, tz=timezone.utc)
    h = dt.hour
    f = hour_factor(h)
    jitter = (random.random() - 0.5) * 0.06

    if sensor.startswith("voltage"):
        return round(220.5 + (random.random() - 0.5) * 3.0, 1)
    elif sensor.startswith("current"):
        base = 8.5 if sensor == "current_1" else 5.2
        return round(base * f * (1 + jitter), 1)
    elif sensor.startswith("power"):
        base = 1874 if sensor == "power_1" else 1137
        v_key = f"voltage_{sensor[-1]}"
        c_key = f"current_{sensor[-1]}"
        v = generate_reading(v_key, t)
        c = generate_reading(c_key, t)
        return round(v * c, 1)
    return 0.0


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, "sensor-publisher")
    
    connected = False
    def on_connect(client, userdata, flags, rc, props=None):
        nonlocal connected
        connected = rc == 0
        status = "connected" if connected else f"failed (rc={rc})"
        print(f"[MQTT] {status} to {BROKER}:{PORT}")

    client.on_connect = on_connect

    try:
        client.connect(BROKER, PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"[MQTT] Cannot connect to {BROKER}:{PORT} — {e}")
        client.loop_start()

    print(f"[Publisher] Starting — interval={INTERVAL}s")
    seq = 0

    while True:
        now = time.time()
        ts = datetime.now(timezone.utc).isoformat()

        for sensor, topic in TOPICS.items():
            value = generate_reading(sensor, now)
            payload = json.dumps({
                "sensor": sensor,
                "value": value,
                "unit": UNITS[sensor],
                "timestamp": ts,
            })
            try:
                client.publish(topic, payload, qos=1)
            except Exception as e:
                print(f"[MQTT] Publish error: {e}")

        seq += 1
        print(f"[Publisher] #{seq} published 6 sensors @ {ts[:19]}")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
