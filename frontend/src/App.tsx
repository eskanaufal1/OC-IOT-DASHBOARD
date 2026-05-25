import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "sonner"
import { isAuthenticated } from "@/lib/api"
import { ThemeProvider, useTheme } from "@/lib/theme"
import { LanguageProvider } from "@/lib/language"
import Layout from "@/components/layout/Layout"
import LoginPage from "@/pages/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import StatisticsPage from "@/pages/StatisticsPage"
import ChatbotPage from "@/pages/ChatbotPage"
import ProfilePage from "@/pages/ProfilePage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AppToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: theme === "dark" ? "#181818" : "#ffffff",
          color: theme === "dark" ? "#e5e5e5" : "#000000",
          border: theme === "dark" ? "1px solid rgba(229,229,229,0.2)" : "1px solid #f3f3f3",
        },
      }}
    />
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppToaster />
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </LanguageProvider>
  )
}
