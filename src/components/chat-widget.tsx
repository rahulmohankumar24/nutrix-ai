"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Check, Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  mealData?: {
    name: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

interface PendingMeal {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  servings: number
}

interface ChatWidgetProps {
  userId: string
  userName?: string
  onMealLogged?: () => void
}

export function ChatWidget({ userId, userName, onMealLogged }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [pendingMeal, setPendingMeal] = useState<PendingMeal | null>(null)
  const [selectedMealType, setSelectedMealType] = useState<string>(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'breakfast'
    if (hour < 16) return 'lunch'
    return 'dinner'
  })
  const [isLogging, setIsLogging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize with greeting when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = userName ? `Hi ${userName}! ` : "Hi! "
      setMessages([{
        id: "1",
        role: "assistant",
        content: greeting + "What did you eat? Just tell me naturally.",
      }])
    }
  }, [isOpen, userName, messages.length])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !userId || pendingMeal) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages(prev => [...prev, userMessage])
    const messageText = input
    setInput("")
    setIsTyping(true)

    try {
      const response = await fetch('/api/nutrition-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, userId })
      })

      if (!response.ok) throw new Error('Failed to process')

      const data = await response.json()

      if (data.mealParsed && data.parsedMeal) {
        setPendingMeal({
          name: data.parsedMeal.name,
          calories: data.parsedMeal.calories,
          protein: data.parsedMeal.protein,
          carbs: data.parsedMeal.carbs,
          fat: data.parsedMeal.fat,
          servings: data.parsedMeal.servings || 1
        })
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Got it! Which meal?",
        }])
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
        }])
      }
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

  const confirmMeal = async () => {
    if (!pendingMeal || !userId) return
    setIsLogging(true)

    try {
      const response = await fetch('/api/log-meal-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: pendingMeal.name,
          calories: pendingMeal.calories,
          protein: pendingMeal.protein,
          carbs: pendingMeal.carbs,
          fat: pendingMeal.fat,
          servings: pendingMeal.servings,
          mealType: selectedMealType
        })
      })

      if (!response.ok) throw new Error('Failed to log meal')

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Logged! +${pendingMeal.protein}g protein`,
        mealData: pendingMeal
      }])
      setPendingMeal(null)
      onMealLogged?.()
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Couldn't save that. Try again?",
      }])
    } finally {
      setIsLogging(false)
    }
  }

  const cancelMeal = () => {
    setPendingMeal(null)
    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "No problem. What else?",
    }])
  }

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] h-[480px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">r</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Rovia Coach</p>
                <p className="text-xs text-muted-foreground">Log meals naturally</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <Minimize2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm">{message.content}</p>
                  {message.mealData && (
                    <p className="text-xs mt-1 opacity-80">
                      {message.mealData.calories} cal · {message.mealData.protein}g pro
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Pending Meal */}
            {pendingMeal && (
              <div className="bg-muted rounded-2xl p-3">
                <p className="font-medium text-sm text-foreground">{pendingMeal.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingMeal.calories} cal · {pendingMeal.protein}g pro · {pendingMeal.carbs}g carbs · {pendingMeal.fat}g fat
                </p>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedMealType(type)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium transition-all capitalize",
                        selectedMealType === type
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-background/80"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={confirmMeal}
                    disabled={isLogging}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                  >
                    {isLogging ? (
                      <div className="h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Log
                  </button>
                  <button
                    onClick={cancelMeal}
                    disabled={isLogging}
                    className="px-3 py-1.5 rounded-lg bg-background text-muted-foreground text-xs hover:bg-background/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-3 py-2">
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "150ms" }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={pendingMeal ? "Select meal type above..." : "I had a chicken salad..."}
                  disabled={!!pendingMeal}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || !!pendingMeal}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    input.trim() && !pendingMeal
                      ? "bg-primary text-primary-foreground"
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

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all z-50",
          isOpen
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-primary text-primary-foreground hover:opacity-90"
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </>
  )
}
