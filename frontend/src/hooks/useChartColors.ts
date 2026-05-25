export function getChartColors(isDark: boolean) {
  return {
    grid: isDark ? "#2d2d2d" : "#e5e7eb",
    axis: isDark ? "#a1a1a1" : "#6b6b6b",
    tooltipBg: isDark ? "#181818" : "#ffffff",
    tooltipBorder: isDark ? "1px solid rgba(229,229,229,0.2)" : "1px solid #e5e7eb",
    tooltipColor: isDark ? "#e5e5e5" : "#000000",
  }
}
