import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  User,
  LogOut,
  Cpu,
  PanelLeft,
  PanelRight,
  Sun,
  Moon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import ThreeBackground from "@/components/ThreeBackground"
import { clearToken } from "@/lib/api"
import { useTheme } from "@/lib/theme"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/statistics", icon: BarChart3, label: "Statistics" },
  { to: "/chatbot", icon: MessageSquare, label: "Chatbot" },
  { to: "/profile", icon: User, label: "Profile" },
]

const SIDEBAR_EXPANDED = "w-56"
const SIDEBAR_COLLAPSED = "w-14"
const SIDEBAR_KEY = "sidebar-collapsed"

export default function Layout() {
  const navigate = useNavigate()
  const { theme, toggle: toggleTheme } = useTheme()
  const isDark = theme === "dark" || theme === "light" ? theme !== "light" : true
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "true")

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_KEY, String(next))
  }

  const handleLogout = () => {
    clearToken()
    navigate("/login")
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-background">
        <ThreeBackground isDark={isDark} />

        {/* Sidebar */}
        <aside
          className={`${collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED} relative z-10 flex shrink-0 flex-col border-r border-border bg-card transition-all duration-200`}
        >
          <div className="flex h-14 items-center justify-center border-b border-border px-3">
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#00a2ed] to-[#0077b6] text-primary-foreground shadow-[0_0_15px_rgba(0,162,237,0.4)]">
              <Cpu className="size-4" />
            </div>
            {!collapsed && (
              <div className="ml-3 flex flex-col leading-none">
                <span className="text-sm font-semibold text-card-foreground">IoT Dashboard</span>
                <span className="text-[10px] text-muted-foreground">Monitor v3.0</span>
              </div>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-2">
            {navItems.map((item) => {
              const link = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    } ${collapsed ? "justify-center" : ""}`
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              )
              if (collapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                )
              }
              return <div key={item.to}>{link}</div>
            })}
          </nav>

          <div className="border-t border-border p-2">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-full" onClick={handleLogout}>
                    <LogOut className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Logout</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
                <LogOut className="size-4" />
                <span>Logout</span>
              </Button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggle}>
              {collapsed ? <PanelRight className="size-4" /> : <PanelLeft className="size-4" />}
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="flex-1 text-sm font-medium text-muted-foreground">
              AI-Powered IoT Monitoring
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleTheme}>
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
