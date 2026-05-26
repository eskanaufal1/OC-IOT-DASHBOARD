import { useState, useEffect, useCallback } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import {
  Zap,
  Activity,
  Gauge,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CircuitBoard,
  LineChart,
  HelpCircle,
} from "lucide-react"
import { fetchSensors, fetchSensorHistory, type Sensor, type SensorReading } from "@/lib/api"
import { useWebSocket } from "@/hooks/useWebSocket"
import { useTheme } from "@/lib/theme"
import { useLanguage, useT } from "@/lib/language"
import { getChartColors } from "@/hooks/useChartColors"

const kpiIcons: Record<string, React.ElementType> = {
  voltage: Zap,
  amperage: Activity,
  power: Gauge,
}

const typeLabels: Record<string, Record<string, string>> = {
  id: { voltage: "tegangan", amperage: "arus", power: "daya" },
  en: { voltage: "voltage", amperage: "amperage", power: "power" },
}

const nameLabels: Record<string, Record<string, string>> = {
  id: { "Voltage 1": "Tegangan 1", "Voltage 2": "Tegangan 2", "Current 1": "Arus 1", "Current 2": "Arus 2", "Power 1": "Daya 1", "Power 2": "Daya 2" },
  en: { "Voltage 1": "Voltage 1", "Voltage 2": "Voltage 2", "Current 1": "Current 1", "Current 2": "Current 2", "Power 1": "Power 1", "Power 2": "Power 2" },
}

const helps: Record<string, Record<string, string>> = {
  id: {
    "Voltage 1": "Tegangan listrik sirkuit 1 dari jaringan PLN. Normal: 210-240V.",
    "Voltage 2": "Tegangan listrik sirkuit 2. Bandingkan dengan V1 untuk keseimbangan.",
    "Current 1": "Arus listrik sirkuit 1 (kulkas). Kompresor menyala 3-8A, mati 0.1-0.3A.",
    "Current 2": "Arus listrik sirkuit 2 (LED Smart TV). 2-3A saat menyala, 0.1A standby.",
    "Power 1": "Daya = Tegangan 1 x Arus 1. Mencerminkan konsumsi kulkas.",
    "Power 2": "Daya = Tegangan 2 x Arus 2. Mencerminkan konsumsi TV.",
    totalPower: "Total daya = P1 + P2. Estimasi biaya dihitung dengan tarif Rp 1.500/kWh.",
    totalCurrent: "Total arus = A1 + A2. Menunjukkan beban listrik keseluruhan.",
    lineBalance: "Selisih |V1-V2|. Di bawah 5V = sangat baik. Di atas 10V = periksa koneksi.",
    loadRatio: "Rasio A2/A1. Normal 0.5-0.7. Di atas 0.9 = beban bergeser ke sirkuit 2.",
    chart: "Klik sensor di atas untuk melihat riwayat. Gunakan tombol 1H/6H/24H/7D untuk rentang waktu.",
    circuit1: "Sirkuit utama dengan beban lebih berat (kulkas, peralatan dapur).",
    circuit2: "Sirkuit kedua dengan beban lebih ringan (TV, perangkat jaringan).",
  },
  en: {
    "Voltage 1": "Grid voltage on circuit 1. Normal range: 210-240V.",
    "Voltage 2": "Grid voltage on circuit 2. Compare with V1 for line balance.",
    "Current 1": "Current on circuit 1 (refrigerator). Compressor ON: 3-8A, OFF: 0.1-0.3A.",
    "Current 2": "Current on circuit 2 (LED Smart TV). ON: 2-3A, standby: 0.1A.",
    "Power 1": "Power = Voltage 1 x Current 1. Reflects refrigerator consumption.",
    "Power 2": "Power = Voltage 2 x Current 2. Reflects TV consumption.",
    totalPower: "Total power = P1 + P2. Cost estimated at Rp 1,500/kWh.",
    totalCurrent: "Total current = A1 + A2. Overall electrical load.",
    lineBalance: "Difference |V1-V2|. Under 5V = excellent. Above 10V = check connections.",
    loadRatio: "A2/A1 ratio. Normal: 0.5-0.7. Above 0.9 = load shifted to circuit 2.",
    chart: "Click a sensor above to view history. Use 1H/6H/24H/7D for time range.",
    circuit1: "Primary circuit with heavier load (refrigerator, kitchen appliances).",
    circuit2: "Secondary circuit with lighter load (TV, networking devices).",
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

const timeRanges = [
  { label: "1H", value: "1h" },
  { label: "6H", value: "6h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
]

function filterReadingsByRange(readings: SensorReading[], range: string): SensorReading[] {
  const now = Date.now()
  const ranges: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  }
  const cutoff = now - (ranges[range] || ranges["24h"])
  return readings.filter((r) => new Date(r.timestamp).getTime() > cutoff)
}

export default function DashboardPage() {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [chartData, setChartData] = useState<SensorReading[]>([])
  const [timeRange, setTimeRange] = useState("6h")
  const [loading, setLoading] = useState(true)
  const [selectedSensor, setSelectedSensor] = useState<number | null>(null)
  const { lastMessage } = useWebSocket()
  const { theme } = useTheme()
  const { lang } = useLanguage()
  const isDark = theme === "dark"
  const c = getChartColors(isDark)
  const t = useT()

  const loadData = useCallback(async () => {
    try {
      const sensorsData = await fetchSensors()
      setSensors(sensorsData)
      if (sensorsData.length > 0 && !selectedSensor) {
        setSelectedSensor(sensorsData[0].id)
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }, [selectedSensor])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!selectedSensor) return
    fetchSensorHistory(selectedSensor)
      .then((data) => setChartData(data))
      .catch(() => {})
  }, [selectedSensor])

  useEffect(() => {
    if (lastMessage && "sensor_id" in lastMessage) {
      setSensors((prev) =>
        prev.map((s) =>
          s.id === lastMessage.sensor_id
            ? {
                ...s,
                latest_value: lastMessage.value as number,
                latest_timestamp: lastMessage.timestamp as string,
              }
            : s
        )
      )
      setChartData((prev) => {
        const newReading: SensorReading = {
          sensor_id: lastMessage.sensor_id as number,
          value: lastMessage.value as number,
          timestamp: lastMessage.timestamp as string,
        }
        const updated = [...prev, newReading]
        if (updated.length > 500) return updated.slice(-500)
        return updated
      })
    }
  }, [lastMessage])

  const filteredChartData = filterReadingsByRange(
    chartData.filter((r) => r.sensor_id === selectedSensor),
    timeRange
  )

  const selectedSensorData = sensors.find((s) => s.id === selectedSensor)

  const getSensor = (name: string) => sensors.find((s) => s.name === name)
  const v1 = getSensor("Voltage 1")?.latest_value
  const v2 = getSensor("Voltage 2")?.latest_value
  const a1 = getSensor("Current 1")?.latest_value
  const a2 = getSensor("Current 2")?.latest_value
  const p1 = getSensor("Power 1")?.latest_value
  const p2 = getSensor("Power 2")?.latest_value
  const totalPower = (p1 ?? 0) + (p2 ?? 0)
  const totalCurrent = (a1 ?? 0) + (a2 ?? 0)
  const lineDiff = v1 != null && v2 != null ? Math.abs(v1 - v2).toFixed(1) : "--"
  const loadRatio = a1 != null && a2 != null ? (a2 / a1).toFixed(2) : "--"
  const monthlyCost = totalPower > 0 ? `Rp ${((totalPower / 1000) * 1500 * 24 * 30).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}` : "--"
  const loadShare1 = totalPower > 0 ? ((p1 ?? 0) / totalPower * 100).toFixed(0) : "--"
  const loadShare2 = totalPower > 0 ? ((p2 ?? 0) / totalPower * 100).toFixed(0) : "--"

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard")}</h1>
        <p className="text-sm text-muted-foreground">
          {lang === "id" ? "Monitoring sensor real-time — 6 sensor di 2 sirkuit" : "Real-time sensor monitoring — 6 sensors across 2 circuits"}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-8 rounded" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-12" />
                </CardContent>
              </Card>
            ))
          : sensors.map((sensor) => {
              const Icon = kpiIcons[sensor.type] || Activity
              return (
                <Card
                  key={sensor.id}
                  className="cursor-pointer transition-colors hover:border-primary/50"
                  onClick={() => setSelectedSensor(sensor.id)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {nameLabels[lang]?.[sensor.name] || sensor.name}
                      <HelpButton lang={lang} helpKey={sensor.name} />
                    </CardTitle>
                    <div
                      className={`rounded-lg p-1.5 ${
                        selectedSensor === sensor.id
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {sensor.latest_value !== undefined
                        ? `${sensor.latest_value.toFixed(1)}`
                        : "--"}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {sensor.unit}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      {sensor.latest_value && sensor.latest_value > 0 ? (
                        <TrendingUp className="h-3 w-3 text-success" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span>{typeLabels[lang]?.[sensor.type] || sensor.type}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
      </div>

      {/* Live Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>
              {(selectedSensorData?.name ? (nameLabels[lang]?.[selectedSensorData.name] || selectedSensorData.name) : "Sensor")} {lang === "id" ? "Riwayat" : "History"}
              <HelpButton lang={lang} helpKey="chart" />
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedSensorData?.unit && `${lang === "id" ? "Satuan" : "Unit"}: ${selectedSensorData.unit}`}
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v)}
          >
            {timeRanges.map((r) => (
              <ToggleGroupItem key={r.value} value={r.value}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={filteredChartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a2ed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00a2ed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
              <XAxis
                dataKey="timestamp"
                tick={{ fill: c.axis, fontSize: 12 }}
                tickFormatter={(v) => new Date(v).toLocaleTimeString()}
              />
              <YAxis tick={{ fill: c.axis, fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: c.tooltipBg,
                  border: c.tooltipBorder,
                  borderRadius: "8px",
                  color: c.tooltipColor,
                }}
                labelFormatter={(v) => new Date(v).toLocaleString()}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#00a2ed"
                strokeWidth={2}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Circuit Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "id" ? "Sirkuit 1 (Utama)" : "Circuit 1 (Primary)"}<HelpButton lang={lang} helpKey="circuit1" /></CardTitle>
            <div className="rounded-lg bg-primary/20 p-1.5 text-primary">
              <CircuitBoard className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{lang === "id" ? "Tegangan 1" : "Voltage 1"}</span>
                <span className="font-mono font-bold">{v1?.toFixed(1) ?? "--"} V</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{lang === "id" ? "Arus 1" : "Current 1"}</span>
                <span className="font-mono font-bold">{a1?.toFixed(1) ?? "--"} A</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{lang === "id" ? "Daya 1" : "Power 1"}</span>
                <span className="font-mono font-bold">{p1?.toFixed(0) ?? "--"} W</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{lang === "id" ? "Beban" : "Load share"}</span>
                <span className="font-mono font-bold">~{loadShare1}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "id" ? "Sirkuit 2 (Kedua)" : "Circuit 2 (Secondary)"}<HelpButton lang={lang} helpKey="circuit2" /></CardTitle>
            <div className="rounded-lg bg-accent p-1.5 text-accent-foreground">
              <CircuitBoard className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{lang === "id" ? "Tegangan 2" : "Voltage 2"}</span>
                <span className="font-mono font-bold">{v2?.toFixed(1) ?? "--"} V</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{lang === "id" ? "Arus 2" : "Current 2"}</span>
                <span className="font-mono font-bold">{a2?.toFixed(1) ?? "--"} A</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{lang === "id" ? "Daya 2" : "Power 2"}</span>
                <span className="font-mono font-bold">{p2?.toFixed(0) ?? "--"} W</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{lang === "id" ? "Beban" : "Load share"}</span>
                <span className="font-mono font-bold">~{loadShare2}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "id" ? "Total Daya" : "Total Power"}<HelpButton lang={lang} helpKey="totalPower" /></CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPower.toFixed(0)}<span className="ml-1 text-sm font-normal text-muted-foreground">W</span></div>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono">{monthlyCost}</span>/{lang === "id" ? "bulan" : "month"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "id" ? "Total Arus" : "Total Current"}<HelpButton lang={lang} helpKey="totalCurrent" /></CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCurrent.toFixed(1)}<span className="ml-1 text-sm font-normal text-muted-foreground">A</span></div>
            <p className="mt-1 text-xs text-muted-foreground">A1 + A2</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "id" ? "Keseimbangan" : "Line Balance"}<HelpButton lang={lang} helpKey="lineBalance" /></CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lineDiff}<span className="ml-1 text-sm font-normal text-muted-foreground">V</span></div>
            <p className="mt-1 text-xs text-muted-foreground">
              {lineDiff !== "--" && parseFloat(lineDiff) < 5 ? (lang === "id" ? "Sangat Baik" : "Excellent") : lineDiff !== "--" ? "Check" : "--"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "id" ? "Rasio Beban" : "Load Ratio"}<HelpButton lang={lang} helpKey="loadRatio" /></CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadRatio}</div>
            <p className="mt-1 text-xs text-muted-foreground">A2 / A1</p>
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  )
}
