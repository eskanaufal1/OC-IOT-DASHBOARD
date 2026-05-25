import { useState, useEffect, useRef, type FormEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageSquare, Send, Bot, User, Loader2, Cpu, Plus, Trash2, Circle } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { fetchChatSessions, deleteChatSession, fetchChatHistory, sendChatQuery, fetchModels, switchModel, type ChatMessage, type ChatSession } from "@/lib/api"
import { toast } from "sonner"

export interface ModelInfo {
  name: string
  filename: string
  size_mb: number
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState("")
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [activeModel, setActiveModel] = useState("")
  const [modelLoaded, setModelLoaded] = useState(false)
  const [modelStatus, setModelStatus] = useState<"loading" | "loaded" | "error">("loading")
  const [switching, setSwitching] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadSessions = async () => {
    try {
      const s = await fetchChatSessions()
      setSessions(s)
    } catch {
      // sessions may not be available if LLM service is down
    }
  }

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const msgs = await fetchChatHistory(sessionId)
      setMessages(msgs)
    } catch {
      setMessages([])
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [s, modelData] = await Promise.all([
          fetchChatSessions(),
          fetchModels(),
        ])
        setSessions(s)
        if (modelData.models?.length > 0) {
          setModels(modelData.models)
          setActiveModel(modelData.active)
          setModelLoaded(modelData.loaded)
          setModelStatus(modelData.loaded ? "loaded" : "error")
        }
        if (s.length > 0) {
          const latest = s[0].id
          setActiveSession(latest)
          await loadSessionMessages(latest)
        }
      } catch {
        // no sessions yet
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSelectSession = async (sid: string) => {
    if (sid === activeSession) return
    if (sid === "__new__") {
      setActiveSession("")
      setMessages([])
      return
    }
    setActiveSession(sid)
    setLoading(true)
    await loadSessionMessages(sid)
    setLoading(false)
  }

  const handleDeleteSession = async (sid: string) => {
    try {
      await deleteChatSession(sid)
      setSessions((prev) => prev.filter((s) => s.id !== sid))
      if (sid === activeSession) {
        setActiveSession("")
        setMessages([])
      }
      toast.success("Session deleted")
    } catch {
      toast.error("Failed to delete session")
    }
  }

  const handleModelSwitch = async (modelName: string) => {
    setSwitching(true)
    setModelStatus("loading")
    try {
      const result = await switchModel(modelName)
      setActiveModel(result.model)
      setModelLoaded(result.loaded)
      setModelStatus(result.loaded ? "loaded" : "error")
      if (result.model === modelName) {
        toast.success(`Switched to ${modelName}`)
      } else {
        toast.error(`${modelName} failed to load — using ${result.model}`)
      }
    } catch {
      toast.error("Failed to switch model")
      setModelStatus("error")
      try {
        const active = await fetchActiveModel()
        setActiveModel(active.model)
        setModelLoaded(active.loaded)
        setModelStatus(active.loaded ? "loaded" : "error")
      } catch {
        // keep error state
      }
    } finally {
      setSwitching(false)
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return

    const question = input.trim()
    setInput("")
    setSending(true)

    const userMsg: ChatMessage = {
      id: Date.now(),
      user_id: 0,
      session_id: activeSession || undefined,
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const { response, session_id, title } = await sendChatQuery(question, activeSession || undefined)
      const assistantMsg: ChatMessage = {
        id: Date.now() + 1,
        user_id: 0,
        session_id: session_id || activeSession,
        role: "assistant",
        content: response,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      if (session_id && session_id !== activeSession) {
        setActiveSession(session_id)
        await loadSessions()
      }
      if (session_id && title) {
        setSessions((prev) =>
          prev.map((s) => (s.id === session_id ? { ...s, title } : s))
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get response")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Chatbot</h1>
        <p className="text-sm text-muted-foreground">
          Ask questions about your circuits — LangGraph + RAG-grounded responses
        </p>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <CardTitle className="text-base">Sensor AI</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {models.length > 0 && (
              <Select value={activeModel} onValueChange={handleModelSwitch} disabled={switching}>
                <SelectTrigger className="h-7 w-[180px] text-xs">
                  <Cpu className="mr-1 h-3 w-3" />
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      <span className="flex items-center gap-2 text-xs">
                        {m.name}
                        <span className="text-muted-foreground">({m.size_mb}MB)</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5" title={modelStatus === "loaded" ? "Ready" : modelStatus === "error" ? "Error" : "Loading..."}>
              {switching ? (
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              ) : modelStatus === "loaded" ? (
                <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
              ) : modelStatus === "error" ? (
                <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              )}
              <span className="text-[10px] text-muted-foreground">
                {switching ? "..." : modelStatus === "loaded" ? "ready" : modelStatus === "error" ? "error" : "loading"}
              </span>
            </div>
          </div>
        </CardHeader>

        {sessions.length > 0 && (
          <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
            <Select value={activeSession || "__new__"} onValueChange={handleSelectSession}>
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between pr-1">
                    <SelectItem value={s.id}>
                      <span className="text-xs">{s.title}</span>
                    </SelectItem>
                    <button
                      type="button"
                      className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <SelectItem value="__new__">
                  <span className="flex items-center gap-1 text-xs">
                    <Plus className="h-3 w-3" /> New Chat
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="gap-1 shrink-0">
              <MessageSquare className="h-3 w-3" />
              {activeSession ? messages.length : 0}
            </Badge>
          </div>
        )}

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full" ref={scrollRef}>
            {loading ? (
              <div className="space-y-4 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "" : "justify-end"}`}>
                    <Skeleton className="h-10 w-8 rounded-full" />
                    <Skeleton className="h-20 w-2/3 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                    <Bot className="mb-3 h-12 w-12 text-muted-foreground/30" />
                    <p className="text-lg font-medium text-muted-foreground">
                      Ask me about your circuits and sensors
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground/60">
                      I analyze 6 sensors across 2 circuits: V1, V2, A1, A2, P1, P2
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {[
                        "Compare circuit 1 and circuit 2",
                        "How much energy am I using per month?",
                        "Is my voltage balanced between V1 and V2?",
                        "What's the load distribution?",
                        "Any recommendations to save energy?",
                        "List all sensors",
                      ].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => { setInput(p); document.querySelector<HTMLInputElement>('input[placeholder="Ask about your circuits..."]')?.focus() }}
                          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground cursor-pointer"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-card-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                            ul: ({ children }) => <ul className="my-1 list-disc pl-4 space-y-0.5">{children}</ul>,
                            ol: ({ children }) => <ol className="my-1 list-decimal pl-4 space-y-0.5">{children}</ol>,
                            li: ({ children }) => <li className="text-card-foreground">{children}</li>,
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-base font-bold text-foreground mt-3 mb-1">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-sm font-bold text-foreground mt-2 mb-1">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
                            code: ({ children }) => <code className="rounded bg-secondary px-1 py-0.5 text-xs font-mono">{children}</code>,
                            pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-secondary p-3 text-xs font-mono">{children}</pre>,
                            hr: () => <hr className="my-2 border-border" />,
                            blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">{children}</blockquote>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.role === "user" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-secondary">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
        <div className="border-t border-border p-3">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your circuits..."
              disabled={sending}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
