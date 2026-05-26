import { useState, useEffect } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import {
  Zap, Activity, Gauge, Wifi, WifiOff,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Cpu, Radio, BarChart3, Power, PowerOff,
  RefreshCw, ScrollText, HelpCircle,
} from "lucide-react"
import { fetchSensors, fetchSensorHistory, fetchMQTTStatus, mqttConnect, mqttDisconnect, type Sensor, type SensorReading } from "@/lib/api"
import { useTheme } from "@/lib/theme"
import { useLanguage } from "@/lib/language"
import { getChartColors } from "@/hooks/useChartColors"

const kpiIcons: Record<string, React.ElementType> = {
  voltage: Zap, amperage: Activity, power: Gauge,
}

const sensorNameID: Record<string, string> = {
  "Voltage 1": "Tegangan 1", "Voltage 2": "Tegangan 2",
  "Current 1": "Arus 1", "Current 2": "Arus 2",
  "Power 1": "Daya 1", "Power 2": "Daya 2",
}

const helps: Record<string, Record<string, string>> = {
  id: {
    mqtt: "Koneksi ke broker MQTT lokal. Data sensor dikirim setiap 60 detik melalui Mosquitto.",
    sensorAktif: "Jumlah sensor yang aktif mengirim data secara real-time.",
    dataPoints: "Total data yang tersimpan di memori (7 hari ke belakang pada interval 60 detik).",
    circuit1: "Sirkuit 1: beban kulkas. Kompresor menyala 40% waktu, 3-8A saat ON.",
    circuit2: "Sirkuit 2: beban LED Smart TV. 2-3A saat menyala (18-23), standby di luar jam tersebut.",
    messages: "Log pesan MQTT terbaru yang diterima. Data diperbarui setiap 15 detik.",
    rata: "Nilai rata-rata dari seluruh data yang tersimpan.",
    simpangan: "Simpangan baku (σ) — semakin kecil semakin stabil.",
    trend: "Grafik 7 hari menunjukkan pola harian penggunaan.",
  },
  en: {
    mqtt: "Connection to local MQTT broker. Sensor data is published every 60 seconds via Mosquitto.",
    sensorAktif: "Number of sensors actively sending real-time data.",
    dataPoints: "Total data stored in memory (7 days back at 60-second intervals).",
    circuit1: "Circuit 1: refrigerator load. Compressor ON 40% of time, 3-8A when active.",
    circuit2: "Circuit 2: LED Smart TV load. 2-3A when ON (18-23), standby otherwise.",
    messages: "Latest MQTT message log received. Data refreshes every 15 seconds.",
    rata: "Average value of all stored readings.",
    simpangan: "Standard deviation (σ) — smaller means more stable.",
    trend: "7-day chart showing daily usage patterns.",
  },
}

function HelpButton({ lang, helpKey }: { lang: string; helpKey: string }) {
  const text = helps[lang]?.[helpKey]
  if (!text) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="ml-1 rounded-full p-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function computeStats(readings: SensorReading[]) {
  if (readings.length === 0) return { avg: 0, min: 0, max: 0, latest: 0, count: 0, stddev: 0, trend: 0 }
  const values = readings.map((r) => r.value)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length
  const latest = values[values.length - 1]
  const oldest = values[0]
  const trend = latest - oldest
  return {
    avg, min: Math.min(...values), max: Math.max(...values),
    latest, count: values.length,
    stddev: Math.sqrt(variance),
    trend,
  }
}

export default function StatisticsPage() {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [histories, setHistories] = useState<Record<number, SensorReading[]>>({})
  const [loading, setLoading] = useState(true)
  const [mqttOnline, setMqttOnline] = useState(false)
  const [mqttBroker, setMqttBroker] = useState("")
  const [lastActive, setLastActive] = useState("")
  const [recentMsgs, setRecentMsgs] = useState<Array<{ sensor: string; value: number; unit: string; timestamp: string }>>([])
  const [mqttLoading, setMqttLoading] = useState(false)
  const { theme } = useTheme()
  const { lang } = useLanguage()
  const isDark = theme === "dark"
  const c = getChartColors(isDark)

  useEffect(() => {
    const load = async () => {
      try {
        const [sensorsData, mqttData] = await Promise.all([
          fetchSensors(),
          fetchMQTTStatus().catch(() => ({ mqtt_online: false, broker: "" })),
        ])
        setSensors(sensorsData)
        setMqttOnline(mqttData.mqtt_online)
        setMqttBroker(mqttData.broker || "")
        setLastActive(mqttData.last_active || "")
        if (mqttData.recent) setRecentMsgs(mqttData.recent)
        const historyMap: Record<number, SensorReading[]> = {}
        await Promise.all(
          sensorsData.map(async (s) => {
            try { historyMap[s.id] = await fetchSensorHistory(s.id) }
            catch { historyMap[s.id] = [] }
          })
        )
        setHistories(historyMap)
      } catch { /* fail silently */ }
      finally { setLoading(false) }
    }
    load()
    const interval = setInterval(() => {
      fetchMQTTStatus().then(d => {
        setMqttOnline(d.mqtt_online)
        setMqttBroker(d.broker || "")
        setLastActive(d.last_active || "")
        if (d.recent) setRecentMsgs(d.recent)
      }).catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleMqttConnect = async () => {
    setMqttLoading(true)
    try { await mqttConnect(); setMqttOnline(true) } catch { /* */ }
    setMqttLoading(false)
  }

  const handleMqttDisconnect = async () => {
    setMqttLoading(true)
    try { await mqttDisconnect(); setMqttOnline(false) } catch { /* */ }
    setMqttLoading(false)
  }

  const getSensor = (name: string) => sensors.find((s) => s.name === name)
  const v1 = getSensor("Voltage 1")?.latest_value
  const v2 = getSensor("Voltage 2")?.latest_value
  const a1 = getSensor("Current 1")?.latest_value
  const a2 = getSensor("Current 2")?.latest_value
  const p1 = getSensor("Power 1")?.latest_value
  const p2 = getSensor("Power 2")?.latest_value
  const totalPower = (p1 ?? 0) + (p2 ?? 0)
  const totalCurrent = (a1 ?? 0) + (a2 ?? 0)
  const totalReadings = sensors.reduce((s, sens) => s + (histories[sens.id]?.length ?? 0), 0)
  const loadShare1 = totalPower > 0 ? ((p1 ?? 0) / totalPower * 100).toFixed(0) : "--"
  const loadShare2 = totalPower > 0 ? ((p2 ?? 0) / totalPower * 100).toFixed(0) : "--"

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{lang === "id" ? "Statistik" : "Statistics"}</h1>
        <p className="text-sm text-muted-foreground">
          {lang === "id" ? "Analisis sensor detail dan manajemen koneksi MQTT" : "Detailed sensor analytics and MQTT connection management"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MQTT Broker<HelpButton lang={lang} helpKey="mqtt" /></CardTitle>
            {mqttOnline ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-destructive" />}
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{mqttOnline ? (lang === "id" ? "Terhubung" : "Connected") : (lang === "id" ? "Offline" : "Offline")}</div>
            <p className="text-xs text-muted-foreground">{mqttBroker || "localhost:1883"}</p>
            {!mqttOnline && lastActive && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {lang === "id" ? "Terakhir aktif: " : "Last active: "}{new Date(lastActive).toLocaleString()}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              {mqttOnline ? (
                <button onClick={handleMqttDisconnect} disabled={mqttLoading}
                  className="flex items-center gap-1 rounded-md bg-destructive/20 px-2 py-1 text-xs text-destructive hover:bg-destructive/30 cursor-pointer">
                  <PowerOff className="h-3 w-3" /> {lang === "id" ? "Putuskan" : "Disconnect"}
                </button>
              ) : (
                <button onClick={handleMqttConnect} disabled={mqttLoading}
                  className="flex items-center gap-1 rounded-md bg-success/20 px-2 py-1 text-xs text-success hover:bg-success/30 cursor-pointer">
                  <Power className="h-3 w-3" /> {lang === "id" ? "Hubungkan" : "Connect"}
                </button>
              )}
              <button onClick={handleMqttConnect} disabled={mqttLoading}
                className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground hover:bg-accent/70 cursor-pointer">
                <RefreshCw className={`h-3 w-3 ${mqttLoading ? "animate-spin" : ""}`} /> {lang === "id" ? "Ulang" : "Reconnect"}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "id" ? "Sensor Aktif" : "Live Sensors"}<HelpButton lang={lang} helpKey="sensorAktif" /></CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{sensors.length} {lang === "id" ? "Aktif" : "Active"}</div>
            <p className="text-xs text-muted-foreground">{lang === "id" ? "Mengirim setiap 60 detik" : "Publishing every 60s"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "id" ? "Data" : "Data Points"}<HelpButton lang={lang} helpKey="dataPoints" /></CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{totalReadings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{lang === "id" ? `Di ${sensors.length} sensor` : `Across ${sensors.length} sensors`}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: lang === "id" ? "Sirkuit 1 (Utama)" : "Circuit 1 (Primary)", v: v1, a: a1, p: p1, load: `~${loadShare1}%`, helpKey: "circuit1" },
          { label: lang === "id" ? "Sirkuit 2 (Kedua)" : "Circuit 2 (Secondary)", v: v2, a: a2, p: p2, load: `~${loadShare2}%`, helpKey: "circuit2" },
        ].map((circuit, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{circuit.label}<HelpButton lang={lang} helpKey={circuit.helpKey} /></CardTitle>
              <div className="rounded-lg bg-primary/20 p-1.5 text-primary">
                <Cpu className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{lang === "id" ? "Tegangan" : "Voltage"}</span>
                  <span className="font-mono font-bold">{circuit.v?.toFixed(1) ?? "--"} V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{lang === "id" ? "Arus" : "Current"}</span>
                  <span className="font-mono font-bold">{circuit.a?.toFixed(1) ?? "--"} A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{lang === "id" ? "Daya" : "Power"}</span>
                  <span className="font-mono font-bold">{circuit.p?.toFixed(0) ?? "--"} W</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{lang === "id" ? "Beban" : "Load share"}</span>
                  <span className="font-mono font-bold">{circuit.load}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
          <CardTitle className="text-sm font-medium">{lang === "id" ? "Pesan MQTT Langsung" : "Live MQTT Messages"}<HelpButton lang={lang} helpKey="messages" /></CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              <ScrollText className="h-3 w-3" />
              {recentMsgs.length}
            </Badge>
            {mqttOnline && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-success inline-block animate-pulse" />
                Live
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recentMsgs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{lang === "id" ? "Belum ada pesan — MQTT mungkin offline" : "No messages yet — MQTT may be offline"}</p>
          ) : (
            <div className="max-h-[240px] overflow-y-auto font-mono text-[11px]">
              {[...recentMsgs].reverse().map((msg, i) => (
                <div key={i} className="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-muted/50">
                  <span className="shrink-0 text-muted-foreground w-[95px]">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="shrink-0 w-[75px] font-semibold text-foreground">
                    {msg.sensor}
                  </span>
                  <span className="font-bold text-primary">
                    {msg.value.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">{msg.unit}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue={sensors[0]?.id?.toString() || "all"}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">{lang === "id" ? "Semua Sensor" : "All Sensors"}</TabsTrigger>
          {sensors.map((s) => (
            <TabsTrigger key={s.id} value={s.id.toString()}>{lang === "id" ? (sensorNameID[s.name] || s.name) : s.name}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sensors.map((sensor) => {
              const stats = computeStats(histories[sensor.id] || [])
              return <SensorStatCard key={sensor.id} sensor={sensor} stats={stats} loading={loading} lang={lang} />
            })}
          </div>
        </TabsContent>

        {sensors.map((sensor) => (
          <TabsContent key={sensor.id} value={sensor.id.toString()}>
            <SensorDetail sensor={sensor} data={histories[sensor.id] || []} loading={loading} c={c} lang={lang} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
    </TooltipProvider>
  )
}

function SensorStatCard({
  sensor, stats, loading, lang,
}: {
  sensor: Sensor
  stats: { avg: number; min: number; max: number; latest: number; count: number; stddev: number; trend: number }
  loading: boolean
  lang: string
}) {
  const Icon = kpiIcons[sensor.type] || Activity
  const isPositive = stats.trend > 0
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {lang === "id" ? (sensorNameID[sensor.name] || sensor.name) : sensor.name}
          <HelpButton lang={lang} helpKey={sensor.name === "Voltage 1" || sensor.name === "Voltage 2" ? "simpangan" : "rata"} />
        </CardTitle>
        <div className="rounded-lg bg-muted p-1.5 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">
                {stats.latest.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">{sensor.unit}</span>
              </span>
              {stats.count > 1 && (
                <span className="flex items-center gap-0.5 text-muted-foreground">
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(stats.trend).toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{lang === "id" ? "Rata" : "Avg"}: {stats.avg.toFixed(2)}</span>
              <span>σ: {stats.stddev.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{lang === "id" ? "Min" : "Min"}: {stats.min.toFixed(1)}</span>
              <span>{lang === "id" ? "Maks" : "Max"}: {stats.max.toFixed(1)}</span>
            </div>
            <div className="text-muted-foreground">{stats.count.toLocaleString()} {lang === "id" ? "data" : "readings"}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SensorDetail({
  sensor, data, loading, c, lang,
}: {
  sensor: Sensor
  data: SensorReading[]
  loading: boolean
  c: ReturnType<typeof getChartColors>
  lang: string
}) {
  const stats = computeStats(data)
  const oneDayAgo = Date.now() - 86400000
  const last24h = data.filter((r) => new Date(r.timestamp).getTime() > oneDayAgo)
  const dayStats = computeStats(last24h)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBadge label={lang === "id" ? "Terbaru" : "Latest"} value={`${stats.latest.toFixed(1)} ${sensor.unit}`} />
        <StatBadge label={lang === "id" ? "Rata (semua)" : "Avg (all)"} value={`${stats.avg.toFixed(2)} ${sensor.unit}`} />
        <StatBadge label={lang === "id" ? "Simpangan" : "Std Dev"} value={`σ ${stats.stddev.toFixed(2)} ${sensor.unit}`} />
        <StatBadge label={lang === "id" ? "Hari ini" : "Today"} value={`${dayStats.avg.toFixed(1)} ${sensor.unit}`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBadge label={lang === "id" ? "Minimum" : "Minimum"} value={`${stats.min.toFixed(1)} ${sensor.unit}`} />
        <StatBadge label={lang === "id" ? "Maksimum" : "Maximum"} value={`${stats.max.toFixed(1)} ${sensor.unit}`} />
        <StatBadge label={lang === "id" ? "Rentang" : "Range"} value={`${(stats.max - stats.min).toFixed(1)} ${sensor.unit}`} />
        <StatBadge label={lang === "id" ? "Sampel" : "Samples"} value={stats.count.toLocaleString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{(lang === "id" ? (sensorNameID[sensor.name] || sensor.name) : sensor.name)} — {lang === "id" ? "Tren 7 Hari" : "7-Day Trend"}<HelpButton lang={lang} helpKey="trend" /></CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`color${sensor.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00a2ed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00a2ed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                <XAxis dataKey="timestamp" tick={{ fill: c.axis, fontSize: 12 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                <YAxis tick={{ fill: c.axis, fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: c.tooltipBg, border: c.tooltipBorder, borderRadius: "8px", color: c.tooltipColor }}
                  labelFormatter={(v) => new Date(v).toLocaleString()} />
                <Area type="monotone" dataKey="value" stroke="#00a2ed" strokeWidth={2} fill={`url(#color${sensor.id})`} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
