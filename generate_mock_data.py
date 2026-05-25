#!/usr/bin/env python3
"""
Generate mock sensor data for PostgreSQL database.
Seeds sensors and historical readings for development/testing.
"""

import random
from datetime import datetime, timedelta, timezone

PG_AVAILABLE = False
try:
    import psycopg2
    PG_AVAILABLE = True
except ImportError:
    print("[WARN] psycopg2 not installed. Run: pip install psycopg2-binary")
    print("[INFO] Running in simulation mode (no database needed)")

DB_CONFIG = {
    "host": "192.168.1.100",
    "port": 5433,
    "database": "iot_dashboard",
    "user": "jelly",
    "password": "jelly1997",
}

SENSOR_DEFS = [
    {"name": "Main Voltage", "type": "voltage", "unit": "V"},
    {"name": "Main Amperage", "type": "amperage", "unit": "A"},
    {"name": "Total Power", "type": "power", "unit": "W"},
    {"name": "Temperature", "type": "temperature", "unit": "°C"},
    {"name": "Humidity", "type": "humidity", "unit": "%"},
]

BASE_VALUES = [220.0, 15.0, 3300.0, 28.0, 65.0]
NOISE = [2.0, 3.0, 500.0, 1.5, 5.0]

SQL_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT NOW(),
    user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sensors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    device_id INTEGER REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
    value DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (username, email, password_hash) VALUES
    ('admin', 'admin@iot.local', '$2a$10$placeholder')
ON CONFLICT (username) DO NOTHING;

INSERT INTO devices (id, name, type, status, user_id) VALUES
    (1, 'Main Panel', 'meter', 'online', 1),
    (2, 'Environmental Sensor', 'sensor', 'online', 1)
ON CONFLICT (id) DO NOTHING;
"""


def generate_readings(sensor_id, base, noise, hours=24):
    readings = []
    now = datetime.now(timezone.utc)
    points = hours * 30  # 1 reading every 2 minutes

    for i in range(points):
        ts = now - timedelta(minutes=(points - i) * 2)
        value = base + random.uniform(-noise, noise)
        readings.append({
            "sensor_id": sensor_id,
            "value": round(value, 2),
            "timestamp": ts.isoformat(),
        })
    return readings


def simulate_generate():
    print("Generating mock sensor data (simulation mode)...\n")
    print("Sensor Definitions:")
    for i, s in enumerate(SENSOR_DEFS):
        print(f"  ID:{i+1} {s['name']} ({s['type']}) — {s['unit']}")

    print(f"\nGenerated 24 hours of readings per sensor (30 readings/hour)")
    for i, (sensor, base, noise) in enumerate(zip(SENSOR_DEFS, BASE_VALUES, NOISE)):
        readings = generate_readings(i + 1, base, noise)
        print(f"  {sensor['name']}: {len(readings)} readings "
              f"(avg: {sum(r['value'] for r in readings)/len(readings):.1f} {sensor['unit']})")


def init_database(conn):
    with conn.cursor() as cur:
        cur.execute(SQL_SCHEMA)
    conn.commit()

    with conn.cursor() as cur:
        for i, sensor in enumerate(SENSOR_DEFS, 1):
            cur.execute(
                "INSERT INTO sensors (id, name, type, unit, device_id) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
                (i, sensor["name"], sensor["type"], sensor["unit"], 1 if i <= 3 else 2),
            )
    conn.commit()

    with conn.cursor() as cur:
        for i, (base, noise) in enumerate(zip(BASE_VALUES, NOISE)):
            readings = generate_readings(i + 1, base, noise, hours=24)
            for r in readings:
                cur.execute(
                    "INSERT INTO sensor_readings (sensor_id, value, timestamp) VALUES (%s, %s, %s)",
                    (r["sensor_id"], r["value"], r["timestamp"]),
                )
    conn.commit()


def main():
    if not PG_AVAILABLE:
        simulate_generate()
        return

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print(f"Connected to PostgreSQL at {DB_CONFIG['host']}:{DB_CONFIG['port']}")
        init_database(conn)
        print("Database seeded successfully!")
        conn.close()
    except Exception as e:
        print(f"Failed to connect to PostgreSQL: {e}")
        print("Falling back to simulation mode...")
        simulate_generate()


if __name__ == "__main__":
    main()
