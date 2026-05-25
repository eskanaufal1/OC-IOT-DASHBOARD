import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Mail, Lock, Eye, EyeOff, Cpu, Sun, Moon } from "lucide-react"
import ThreeBackground from "@/components/ThreeBackground"
import { login } from "@/lib/api"
import { useTheme } from "@/lib/theme"
import { toast } from "sonner"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { theme, toggle: toggleTheme } = useTheme()
  const isDark = theme === "dark"

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      toast.success("Login berhasil")
      navigate("/")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login gagal")
    } finally {
      setLoading(false)
    }
  }

  const c = {
    bg: isDark
      ? "bg-[linear-gradient(135deg,#0a0a1f_0%,#1a1a2e_100%)]"
      : "bg-[linear-gradient(135deg,#e2e8f0_0%,#bae6fd_100%)]",
    card: isDark
      ? "border-[rgba(0,162,237,0.2)] bg-white/[0.07]"
      : "border-[rgba(0,119,182,0.2)] bg-white/90",
    shadow: isDark
      ? "shadow-[0_30px_60px_-15px_rgba(0,162,237,0.3)]"
      : "shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)]",
    heading: isDark ? "text-white" : "text-slate-900",
    subtitle: isDark ? "text-[#94a3b8]" : "text-slate-500",
    inputBg: isDark
      ? "bg-white/[0.08] border-white/[0.15] text-white placeholder:text-white/30"
      : "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400",
    inputFocus: "focus:border-[#00a2ed] focus:shadow-[0_0_0_4px_rgba(0,162,237,0.15)]",
    inputIcon: isDark ? "text-[#94a3b8]" : "text-slate-400",
    toggleBg: isDark
      ? "bg-white/[0.12] text-white hover:bg-white/[0.25]"
      : "bg-slate-200 text-slate-700 hover:bg-slate-300",
    label: isDark ? "text-[#94a3b8]" : "text-slate-500",
    footer: isDark ? "text-[#64748b]" : "text-slate-400",
    logoGlow: isDark ? "shadow-[0_0_25px_#00a2ed]" : "shadow-md",
    logoTextGlow: isDark ? "text-white [text-shadow:0_0_20px_#00a2ed]" : "text-slate-800 font-extrabold",
    pwdToggle: isDark ? "text-[#94a3b8] hover:text-white" : "text-slate-400 hover:text-slate-800",
  }

  return (
    <div className={`relative flex min-h-screen items-center justify-center p-4 ${c.bg}`}>
      <ThreeBackground isDark={isDark} />

      <div className={`relative z-10 w-full max-w-[420px] rounded-[28px] border px-9 py-12 backdrop-blur-[20px] ${c.card} ${c.shadow}`}>
        <div className="absolute right-6 top-6 z-10">
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-xl transition-all hover:scale-110 ${c.toggleBg}`}
            title="Toggle Dark/Light Mode"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        <div className="mb-9 flex items-center justify-center gap-3.5">
          <div className={`flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-gradient-to-br from-[#00a2ed] to-[#0077b6] text-[30px] ${c.logoGlow}`}>
            <Cpu className="h-6 w-6 text-white" />
          </div>
          <h1 className={`text-[36px] leading-none tracking-[-2px] ${c.logoTextGlow}`}>
            IoT
          </h1>
        </div>

        <h2 className={`mb-2.5 text-center text-[28px] font-bold leading-tight ${c.heading}`}>
          Selamat datang
        </h2>
        <p className={`mb-9 text-center ${c.subtitle}`}>
          Masuk ke dashboard monitoring Anda
        </p>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-[22px]">
            <Mail className={`absolute left-[22px] top-1/2 h-4 w-4 -translate-y-1/2 ${c.inputIcon}`} />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              className={`w-full rounded-[18px] border py-[18px] pl-14 pr-5 text-[17px] outline-none ${c.inputBg} ${c.inputFocus}`}
            />
          </div>

          <div className="relative mb-[22px]">
            <Lock className={`absolute left-[22px] top-1/2 h-4 w-4 -translate-y-1/2 ${c.inputIcon}`} />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className={`w-full rounded-[18px] border py-[18px] pl-14 pr-12 text-[17px] outline-none ${c.inputBg} ${c.inputFocus}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute right-[22px] top-1/2 -translate-y-1/2 bg-transparent ${c.pwdToggle}`}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className={`mb-7 flex items-center justify-between text-sm ${c.label}`}>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="accent-[#00a2ed]" />
              Ingat saya
            </label>
            <button type="button" className="text-[#00a2ed] hover:underline">
              Lupa password?
            </button>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-auto w-full rounded-[18px] bg-gradient-to-r from-[#00a2ed] to-[#0077b6] py-[18px] text-lg font-bold tracking-[0.5px] text-white hover:from-[#00b0ff] hover:to-[#0080cc]"
          >
            {loading ? "Memproses..." : "Masuk"}
          </Button>
        </form>

        <p className={`mt-10 text-center text-[13px] ${c.footer}`}>
          &copy; 2026 IoT Dashboard &bull; Akses Aman
        </p>
      </div>
    </div>
  )
}
