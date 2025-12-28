"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Sparkles, MessageCircle, Lock, Crown } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface AnalyticsChatProps {
  userId: string
  isPro?: boolean
}

const SUGGESTED_QUESTIONS = [
  "How did I do this week?",
  "What's my protein intake like?",
  "When do I eat the most?",
  "What are my best days?",
]

export function AnalyticsChat({ userId, isPro = false }: AnalyticsChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isExpanded])

  useEffect(() => {
    if (isExpanded && isPro) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isExpanded, isPro])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !userId || !isPro) return

    await sendMessage(input.trim())
  }

  const sendMessage = async (messageText: string) => {
    if (!isPro) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    try {
      const response = await fetch('/api/analytics-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          userId
        })
      })

      if (!response.ok) throw new Error('Failed to process')

      const data = await response.json()

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || "I couldn't analyze that. Try asking another way?",
      }])
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Try again?",
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSuggestionClick = (question: string) => {
    if (!isPro) return
    sendMessage(question)
  }

  const handleCardClick = () => {
    if (isPro) {
      setIsExpanded(!isExpanded)
    }
  }

  // Non-Pro locked state - matches other card layout
  if (!isPro) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border/50 relative overflow-hidden">
        {/* Pro badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
          <Crown className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-amber-600">PRO</span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-purple-500" />
          </div>
          <h3 className="font-semibold text-foreground">Ask AI Coach</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Get personalized answers about your nutrition patterns, habits, and progress.
        </p>

        {/* Locked preview */}
        <div className="relative">
          <div className="space-y-2 opacity-50 blur-[2px]">
            <p className="text-sm text-muted-foreground">Ask: "How did I do this week?"</p>
            <p className="text-sm text-muted-foreground">Ask: "What's my protein intake like?"</p>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium shadow-lg hover:shadow-xl transition-shadow">
              <Lock className="h-4 w-4" />
              Upgrade to Pro
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Pro user - expandable chat card
  return (
    <div className="bg-card rounded-2xl border border-border/50 hover:border-purple-500/30 hover:shadow-lg transition-all overflow-hidden">
      {/* Card Header - clickable to expand */}
      <div
        className="p-5 cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-purple-500" />
            </div>
            <h3 className="font-semibold text-foreground">Ask AI Coach</h3>
          </div>
          <div className={cn(
            "h-8 w-8 rounded-full bg-muted flex items-center justify-center transition-transform",
            isExpanded && "rotate-180"
          )}>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {!isExpanded && (
          <p className="text-sm text-muted-foreground">
            Ask questions about your nutrition patterns and get personalized insights.
          </p>
        )}
      </div>

      {/* Expanded Chat Area */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Messages */}
          <div className="max-h-[280px] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-2">
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      onClick={() => handleSuggestionClick(question)}
                      className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground hover:text-foreground hover:bg-purple-500/10 hover:text-purple-600 transition-all"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 mr-2 mt-1">
                        <div className="h-7 w-7 rounded-full bg-purple-500/10 flex items-center justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        </div>
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex-shrink-0 mr-2 mt-1">
                      <div className="h-7 w-7 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-muted px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-muted/30">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-2 rounded-xl bg-background border border-border px-4 py-2.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your nutrition..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className={cn(
                    "rounded-lg p-2 transition-all",
                    input.trim()
                      ? "bg-purple-500 text-white hover:bg-purple-600"
                      : "text-muted-foreground"
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
