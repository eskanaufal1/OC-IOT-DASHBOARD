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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Zap, Activity, Gauge } from "lucide-react"
import { fetchSensors, fetchSensorHistory, type Sensor, type SensorReading } from "@/lib/api"
import { useTheme } from "@/lib/theme"
import { getChartColors } from "@/hooks/useChartColors"

const kpiIcons: Record<string, React.ElementType> = {
  voltage: Zap,
  amperage: Activity,
  power: Gauge,
}

function computeStats(readings: SensorReading[]) {
  if (readings.length === 0) return { avg: 0, min: 0, max: 0, latest: 0, count: 0 }
  const values = readings.map((r) => r.value)
  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    latest: values[values.length - 1],
    count: values.length,
  }
}

export default function StatisticsPage() {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [histories, setHistories] = useState<Record<number, SensorReading[]>>({})
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const c = getChartColors(isDark)

  useEffect(() => {
    const load = async () => {
      try {
        const sensorsData = await fetchSensors()
        setSensors(sensorsData)
        const historyMap: Record<number, SensorReading[]> = {}
        await Promise.all(
          sensorsData.map(async (s) => {
            try {
              historyMap[s.id] = await fetchSensorHistory(s.id)
            } catch {
              historyMap[s.id] = []
            }
          })
        )
        setHistories(historyMap)
      } catch {
        // fail silently
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
        <p className="text-sm text-muted-foreground">
          Historical sensor data with statistical analysis
        </p>
      </div>

      <Tabs defaultValue={sensors[0]?.id?.toString() || "all"} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Sensors</TabsTrigger>
          {sensors.map((s) => (
            <TabsTrigger key={s.id} value={s.id.toString()}>
              {s.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {sensors.map((sensor) => {
              const stats = computeStats(histories[sensor.id] || [])
              return (
                <SensorStatCard key={sensor.id} sensor={sensor} stats={stats} loading={loading} />
              )
            })}
          </div>
        </TabsContent>

        {sensors.map((sensor) => {
          const data = histories[sensor.id] || []
          return (
            <TabsContent key={sensor.id} value={sensor.id.toString()}>
              <SensorChart sensor={sensor} data={data} loading={loading} c={c} />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

function SensorStatCard({
  sensor,
  stats,
  loading,
}: {
  sensor: Sensor
  stats: { avg: number; min: number; max: number; latest: number; count: number }
  loading: boolean
}) {
  const Icon = kpiIcons[sensor.type] || Activity
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {sensor.name}
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
          <div className="space-y-1 text-xs">
            <div className="text-lg font-bold">
              {stats.latest.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">{sensor.unit}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Avg: {stats.avg.toFixed(2)}</span>
              <span>Min: {stats.min.toFixed(1)}</span>
              <span>Max: {stats.max.toFixed(1)}</span>
            </div>
            <div className="text-muted-foreground">{stats.count} readings</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SensorChart({
  sensor,
  data,
  loading,
  c,
}: {
  sensor: Sensor
  data: SensorReading[]
  loading: boolean
  c: ReturnType<typeof getChartColors>
}) {
  const stats = computeStats(data)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatBadge label="Average" value={`${stats.avg.toFixed(2)} ${sensor.unit}`} />
        <StatBadge label="Minimum" value={`${stats.min.toFixed(1)} ${sensor.unit}`} />
        <StatBadge label="Maximum" value={`${stats.max.toFixed(1)} ${sensor.unit}`} />
        <StatBadge label="Samples" value={stats.count.toString()} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{sensor.name} — Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`color${sensor.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0070d1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0070d1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fill: c.axis, fontSize: 12 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString()}
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
                  stroke="#0070d1"
                  strokeWidth={2}
                  fill={`url(#color${sensor.id})`}
                />
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
