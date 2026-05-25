module.exports = {
  apps: [
    {
      name: "iot-python-llm",
      script: "C:\\Users\\Jellyz\\AppData\\Local\\Programs\\Python\\Python314\\python.exe",
      args: "-u main.py",
      cwd: "D:\\OC-IOT-THESIS\\backend-python",
      env: {
        PORT: "8001",
        PYTHONUNBUFFERED: "1",
        DEFAULT_MODEL: "gemma3:1b",
        OLLAMA_URL: "http://localhost:11434",
      },
      autorestart: true,
      max_restarts: 5,
      restart_delay: 15000,
      kill_timeout: 5000,
    },
    {
      name: "iot-go-backend",
      script: "D:\\OC-IOT-THESIS\\backend-go\\iot-backend.exe",
      cwd: "D:\\OC-IOT-THESIS\\backend-go",
      env: {
        PORT: "8002",
        JWT_SECRET: "iot-dashboard-secret-key-change-in-production",
        LLM_URL: "http://localhost:8001",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "iot-frontend",
      script: ".\\node_modules\\vite\\bin\\vite.js",
      args: "--host 0.0.0.0 --port 5174",
      cwd: "D:\\OC-IOT-THESIS\\frontend",
      interpreter: "node",
      env: {
        NODE_ENV: "development",
      },
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
    },
  ],
};
