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
import {
  Zap,
  Activity,
  Gauge,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { fetchSensors, fetchSensorHistory, type Sensor, type SensorReading } from "@/lib/api"
import { useWebSocket } from "@/hooks/useWebSocket"
import { useTheme } from "@/lib/theme"
import { getChartColors } from "@/hooks/useChartColors"

const kpiIcons: Record<string, React.ElementType> = {
  voltage: Zap,
  amperage: Activity,
  power: Gauge,
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
  const isDark = theme === "dark"
  const c = getChartColors(isDark)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Real-time sensor monitoring — 6 sensors across 2 circuits
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
                      {sensor.name}
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
                      <span>{sensor.type}</span>
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
              {selectedSensorData?.name || "Sensor"} History
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedSensorData?.unit && `Unit: ${selectedSensorData.unit}`}
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
    </div>
  )
}
