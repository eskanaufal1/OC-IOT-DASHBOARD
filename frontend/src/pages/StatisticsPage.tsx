import { useState, useEffect } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Zap, Activity, Gauge, Wifi, WifiOff,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Cpu, Radio, Clock, BarChart3, Power, PowerOff,
  RefreshCw, ScrollText,
} from "lucide-react"
import { fetchSensors, fetchSensorHistory, fetchMQTTStatus, mqttConnect, mqttDisconnect, type Sensor, type SensorReading } from "@/lib/api"
import { useTheme } from "@/lib/theme"
import { getChartColors } from "@/hooks/useChartColors"

const kpiIcons: Record<string, React.ElementType> = {
  voltage: Zap, amperage: Activity, power: Gauge,
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
  const [recentMsgs, setRecentMsgs] = useState<Array<{ sensor: string; value: number; unit: string; timestamp: string }>>([])
  const [mqttLoading, setMqttLoading] = useState(false)
  const { theme } = useTheme()
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
        <p className="text-sm text-muted-foreground">
          Detailed sensor analytics and MQTT connection management
        </p>
      </div>

      {/* MQTT Status + System Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MQTT Broker</CardTitle>
            {mqttOnline ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-destructive" />}
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{mqttOnline ? "Connected" : "Offline"}</div>
            <p className="text-xs text-muted-foreground">{mqttBroker || "localhost"}:1883</p>
            <div className="mt-3 flex gap-2">
              {mqttOnline ? (
                <button onClick={handleMqttDisconnect} disabled={mqttLoading}
                  className="flex items-center gap-1 rounded-md bg-destructive/20 px-2 py-1 text-xs text-destructive hover:bg-destructive/30 cursor-pointer">
                  <PowerOff className="h-3 w-3" /> Disconnect
                </button>
              ) : (
                <button onClick={handleMqttConnect} disabled={mqttLoading}
                  className="flex items-center gap-1 rounded-md bg-success/20 px-2 py-1 text-xs text-success hover:bg-success/30 cursor-pointer">
                  <Power className="h-3 w-3" /> Connect
                </button>
              )}
              <button onClick={handleMqttConnect} disabled={mqttLoading}
                className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground hover:bg-accent/70 cursor-pointer">
                <RefreshCw className={`h-3 w-3 ${mqttLoading ? "animate-spin" : ""}`} /> Reconnect
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Sensors</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{sensors.length} Active</div>
            <p className="text-xs text-muted-foreground">Publishing every 60s</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Data Points</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{totalReadings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across {sensors.length} sensors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Est. Monthly</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">${totalPower > 0 ? ((totalPower / 1000) * 0.12 * 24 * 30).toFixed(0) : "--"}</div>
            <p className="text-xs text-muted-foreground">{totalPower.toFixed(0)}W × $0.12/kWh</p>
          </CardContent>
        </Card>
      </div>

      {/* Circuit Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "Circuit 1 (Primary)", v: v1, a: a1, p: p1, load: "~64%" },
          { label: "Circuit 2 (Secondary)", v: v2, a: a2, p: p2, load: "~36%" },
        ].map((circuit, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{circuit.label}</CardTitle>
              <div className="rounded-lg bg-primary/20 p-1.5 text-primary">
                <Cpu className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Voltage</span>
                  <span className="font-mono font-bold">{circuit.v?.toFixed(1) ?? "--"} V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current</span>
                  <span className="font-mono font-bold">{circuit.a?.toFixed(1) ?? "--"} A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Power</span>
                  <span className="font-mono font-bold">{circuit.p?.toFixed(0) ?? "--"} W</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Load share</span>
                  <span className="font-mono font-bold">{circuit.load}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live MQTT Messages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Live MQTT Messages</CardTitle>
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
        <CardContent>
          {recentMsgs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No messages yet — MQTT may be offline</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-1 font-mono text-xs">
              {[...recentMsgs].reverse().map((msg, i) => (
                <div key={i} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                  <span className="shrink-0 text-muted-foreground w-[110px]">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="shrink-0 w-[80px] font-semibold text-foreground">
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

      {/* Sensor Detail Tabs */}
      <Tabs defaultValue={sensors[0]?.id?.toString() || "all"}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Sensors</TabsTrigger>
          {sensors.map((s) => (
            <TabsTrigger key={s.id} value={s.id.toString()}>{s.name}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sensors.map((sensor) => {
              const stats = computeStats(histories[sensor.id] || [])
              return <SensorStatCard key={sensor.id} sensor={sensor} stats={stats} loading={loading} />
            })}
          </div>
        </TabsContent>

        {sensors.map((sensor) => (
          <TabsContent key={sensor.id} value={sensor.id.toString()}>
            <SensorDetail sensor={sensor} data={histories[sensor.id] || []} loading={loading} c={c} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function SensorStatCard({
  sensor, stats, loading,
}: {
  sensor: Sensor
  stats: { avg: number; min: number; max: number; latest: number; count: number; stddev: number; trend: number }
  loading: boolean
}) {
  const Icon = kpiIcons[sensor.type] || Activity
  const isPositive = stats.trend > 0
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{sensor.name}</CardTitle>
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
              <span>Avg: {stats.avg.toFixed(2)}</span>
              <span>σ: {stats.stddev.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Min: {stats.min.toFixed(1)}</span>
              <span>Max: {stats.max.toFixed(1)}</span>
            </div>
            <div className="text-muted-foreground">{stats.count.toLocaleString()} readings</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SensorDetail({
  sensor, data, loading, c,
}: {
  sensor: Sensor
  data: SensorReading[]
  loading: boolean
  c: ReturnType<typeof getChartColors>
}) {
  const stats = computeStats(data)
  const oneDayAgo = Date.now() - 86400000
  const last24h = data.filter((r) => new Date(r.timestamp).getTime() > oneDayAgo)
  const dayStats = computeStats(last24h)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBadge label="Latest" value={`${stats.latest.toFixed(1)} ${sensor.unit}`} />
        <StatBadge label="Avg (all)" value={`${stats.avg.toFixed(2)} ${sensor.unit}`} />
        <StatBadge label="Std Dev" value={`σ ${stats.stddev.toFixed(2)} ${sensor.unit}`} />
        <StatBadge label="Today" value={`${dayStats.avg.toFixed(1)} ${sensor.unit}`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBadge label="Minimum" value={`${stats.min.toFixed(1)} ${sensor.unit}`} />
        <StatBadge label="Maximum" value={`${stats.max.toFixed(1)} ${sensor.unit}`} />
        <StatBadge label="Range" value={`${(stats.max - stats.min).toFixed(1)} ${sensor.unit}`} />
        <StatBadge label="Samples" value={stats.count.toLocaleString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{sensor.name} — 7-Day Trend</CardTitle>
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
                <Tooltip
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
