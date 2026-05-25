import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type Language = "id" | "en"

const LanguageContext = createContext<{
  lang: Language
  toggle: () => void
}>({ lang: "id", toggle: () => {} })

export function useLanguage() {
  return useContext(LanguageContext)
}

function getInitialLang(): Language {
  try {
    const saved = localStorage.getItem("lang")
    if (saved === "en" || saved === "id") return saved
  } catch {}
  return "id"
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(getInitialLang)

  useEffect(() => {
    localStorage.setItem("lang", lang)
    document.documentElement.setAttribute("data-lang", lang)
  }, [lang])

  const toggle = () => setLang((l) => (l === "id" ? "en" : "id"))

  return (
    <LanguageContext.Provider value={{ lang, toggle }}>
      {children}
    </LanguageContext.Provider>
  )
}

// Translation map
export const t = {
  dashboard: { id: "Dashboard", en: "Dashboard" },
  statistics: { id: "Statistik", en: "Statistics" },
  chatbot: { id: "Chatbot", en: "Chatbot" },
  profile: { id: "Profil", en: "Profile" },
  logout: { id: "Keluar", en: "Logout" },
  monitorTitle: { id: "Monitor IoT", en: "AI-Powered IoT Monitoring" },
  sensorMonitoring: { id: "Monitoring sensor real-time — 6 sensor di 2 sirkuit", en: "Real-time sensor monitoring — 6 sensors across 2 circuits" },
  sensorHistory: { id: "Riwayat {sensor}", en: "{sensor} History" },
  unit: { id: "Satuan: {unit}", en: "Unit: {unit}" },
  totalPower: { id: "Total Daya", en: "Total Power" },
  totalCurrent: { id: "Total Arus", en: "Total Current" },
  lineBalance: { id: "Keseimbangan", en: "Line Balance" },
  loadRatio: { id: "Rasio Beban", en: "Load Ratio" },
  excellent: { id: "Sangat Baik", en: "Excellent" },
  perBulan: { id: "per bulan", en: "/month" },
  circuit1: { id: "Sirkuit 1 (Utama)", en: "Circuit 1 (Primary)" },
  circuit2: { id: "Sirkuit 2 (Kedua)", en: "Circuit 2 (Secondary)" },
  tegangan: { id: "Tegangan", en: "Voltage" },
  arus: { id: "Arus", en: "Current" },
  daya: { id: "Daya", en: "Power" },
  beban: { id: "Beban", en: "Load share" },
  liveChart: { id: "Grafik Langsung", en: "Live Chart" },
  selectSensor: { id: "Pilih sensor di atas untuk melihat grafik", en: "Select a sensor above to view chart" },
  // Statistics page
  statistik: { id: "Statistik", en: "Statistics" },
  statDesc: { id: "Analisis sensor detail dan manajemen koneksi MQTT", en: "Detailed sensor analytics and MQTT connection management" },
  mqttBroker: { id: "MQTT Broker", en: "MQTT Broker" },
  terhubung: { id: "Terhubung", en: "Connected" },
  offline: { id: "Offline", en: "Offline" },
  putuskan: { id: "Putuskan", en: "Disconnect" },
  hubungkan: { id: "Hubungkan", en: "Connect" },
  ulang: { id: "Ulang", en: "Reconnect" },
  sensorAktif: { id: "Sensor Aktif", en: "Live Sensors" },
  aktif: { id: "Aktif", en: "Active" },
  mengirim60: { id: "Mengirim setiap 60 detik", en: "Publishing every 60s" },
  dataPoints: { id: "Data", en: "Data Points" },
  diSensor: { id: "Di {n} sensor", en: "Across {n} sensors" },
  pesanMQTT: { id: "Pesan MQTT Langsung", en: "Live MQTT Messages" },
  belumAdaPesan: { id: "Belum ada pesan — MQTT mungkin offline", en: "No messages yet — MQTT may be offline" },
  semuaSensor: { id: "Semua Sensor", en: "All Sensors" },
  rata: { id: "Rata", en: "Avg" },
  min: { id: "Min", en: "Min" },
  maks: { id: "Maks", en: "Max" },
  data: { id: "data", en: "readings" },
  terbaru: { id: "Terbaru", en: "Latest" },
  rataSemua: { id: "Rata (semua)", en: "Avg (all)" },
  simpangan: { id: "Simpangan", en: "Std Dev" },
  hariIni: { id: "Hari ini", en: "Today" },
  minimum: { id: "Minimum", en: "Minimum" },
  maksimum: { id: "Maksimum", en: "Maximum" },
  rentang: { id: "Rentang", en: "Range" },
  sampel: { id: "Sampel", en: "Samples" },
  tren7: { id: "Tren 7 Hari", en: "7-Day Trend" },
  // Chatbot
  aiChatbot: { id: "Chatbot AI", en: "AI Chatbot" },
  chatbotDesc: { id: "Tanyakan tentang sirkuit Anda — respons berbasis LangGraph + RAG", en: "Ask about your circuits — LangGraph + RAG-grounded responses" },
  selectModel: { id: "Pilih model", en: "Select model" },
  newChat: { id: "Obrolan Baru", en: "New Chat" },
  selectSession: { id: "Pilih sesi", en: "Select session" },
  askAbout: { id: "Tanyakan tentang sirkuit Anda", en: "Ask about your circuits" },
  thinking: { id: "Berpikir...", en: "Thinking..." },
  sensorAI: { id: "Sensor AI", en: "Sensor AI" },
  // Profile
  profil: { id: "Profil", en: "Profile" },
  profileDesc: { id: "Kelola pengaturan akun Anda", en: "Manage your account settings" },
  editProfile: { id: "Edit Profil", en: "Edit Profile" },
  username: { id: "Nama Pengguna", en: "Username" },
  email: { id: "Email", en: "Email" },
  save: { id: "Simpan", en: "Save" },
  // Login
  selamatDatang: { id: "Selamat datang", en: "Welcome back" },
  masukDashboard: { id: "Masuk ke dashboard monitoring Anda", en: "Sign in to your IoT dashboard" },
  ingatSaya: { id: "Ingat saya", en: "Remember me" },
  lupaPassword: { id: "Lupa password?", en: "Forgot password?" },
  masuk: { id: "Masuk", en: "Sign In" },
  memproses: { id: "Memproses...", en: "Processing..." },
  aksesAman: { id: "Akses Aman", en: "Secure Access" },
}

export function useT() {
  const { lang } = useLanguage()
  return (key: keyof typeof t, vars?: Record<string, string | number>) => {
    let text = t[key]?.[lang] ?? String(key)
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v))
      })
    }
    return text
  }
}
