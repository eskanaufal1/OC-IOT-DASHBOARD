"""
MQTT Sensor Publisher — publishes 6 sensor readings every 60 seconds via Mosquitto.
Home devices: Circuit 1 = Kulkas (refrigerator), Circuit 2 = LED Smart TV.
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

_REFRIGERATOR_CYCLE = 1800  # 30-minute compressor cycle


def _refrigerator_compressor_on(timestamp: float) -> bool:
    """Refrigerator compressor cycles ~40% duty, 30 min period."""
    cycle_pos = (timestamp % _REFRIGERATOR_CYCLE) / _REFRIGERATOR_CYCLE
    return cycle_pos < 0.40


def generate_reading(sensor: str, t: float) -> float:
    dt = datetime.fromtimestamp(t, tz=timezone.utc)
    h = dt.hour

    if sensor.startswith("voltage"):
        return round(220.5 + (random.random() - 0.5) * 3.0, 1)

    elif sensor == "current_1":
        # Kulkas (Refrigerator) — compressor cycles
        if _refrigerator_compressor_on(t):
            # Compressor running: 3-8A with slight variation
            draw = random.uniform(3.5, 7.5)
            # Slightly higher in hot afternoon
            if 12 <= h <= 16:
                draw += 0.5
        else:
            # Compressor off: only control electronics
            draw = random.uniform(0.1, 0.3)
        return round(draw, 1)

    elif sensor == "current_2":
        # LED Smart TV
        if 18 <= h <= 23:
            # Evening: TV is ON
            draw = random.uniform(1.8, 3.0)
        elif 6 <= h <= 9:
            # Morning: maybe brief news check
            draw = random.uniform(0.5, 1.2)
        elif 10 <= h <= 17:
            # Daytime: standby/off
            draw = random.uniform(0.1, 0.3)
        else:
            # Night (00-05): standby only
            draw = random.uniform(0.03, 0.08)
        return round(draw, 1)

    elif sensor.startswith("power"):
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
    except Exception as e:
        print(f"[MQTT] Cannot connect to {BROKER}:{PORT} — {e}")

    client.loop_start()
    print(f"[Publisher] Kulkas + LED Smart TV — interval={INTERVAL}s")
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
