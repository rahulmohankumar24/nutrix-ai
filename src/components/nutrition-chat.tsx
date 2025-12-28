"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
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

interface MacroProgress {
  current: { calories: number; protein: number; carbs: number; fat: number }
  targets: { calories: number; protein: number; carbs: number; fat: number }
  remaining: { calories: number; protein: number; carbs: number; fat: number }
}

interface NutritionChatProps {
  userId: string
  userName?: string
  macros?: MacroProgress | null
  onMealLogged?: () => void
  className?: string
}

export function NutritionChat({ userId, userName, macros, onMealLogged, className }: NutritionChatProps) {
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
  const isInitialLoad = useRef(true)

  useEffect(() => {
    let greeting = "Hi"
    if (userName) greeting += ` ${userName}`

    let contextMessage = ""
    if (macros) {
      const caloriesLeft = macros.remaining.calories
      const proteinLeft = macros.remaining.protein
      if (caloriesLeft > macros.targets.calories * 0.7) {
        contextMessage = ". What did you have to eat?"
      } else if (caloriesLeft > macros.targets.calories * 0.3) {
        contextMessage = `. You have ${caloriesLeft} calories left today. What's next?`
      } else {
        contextMessage = ". You're doing great today! Anything else to log?"
      }
    } else {
      contextMessage = ". Tell me what you ate, or ask me anything."
    }

    setMessages([{
      id: "1",
      role: "assistant",
      content: greeting + contextMessage,
      timestamp: new Date(),
    }])
  }, [userName, macros])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    // Skip scroll on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }
    scrollToBottom()
  }, [messages, pendingMeal])

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !userId || pendingMeal) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const messageText = input
    setInput("")
    setIsTyping(true)

    try {
      const response = await fetch('/api/nutrition-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          userId,
          currentHour: new Date().getHours(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      })

      if (!response.ok) {
        throw new Error('Failed to process message')
      }

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

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Got it. Which meal was this?`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Failed to process:', error)

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Try again?",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
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

      if (!response.ok) {
        throw new Error('Failed to log meal')
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Logged. +${pendingMeal.protein}g protein`,
        timestamp: new Date(),
        mealData: {
          name: pendingMeal.name,
          calories: pendingMeal.calories,
          protein: pendingMeal.protein,
          carbs: pendingMeal.carbs,
          fat: pendingMeal.fat
        }
      }

      setMessages((prev) => [...prev, assistantMessage])
      setPendingMeal(null)
      onMealLogged?.()
    } catch (error) {
      console.error('Failed to log meal:', error)

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Couldn't save that. Try again?",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLogging(false)
    }
  }

  const cancelMeal = () => {
    setPendingMeal(null)
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "No problem. What else?",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMessage])
  }

  const suggestions = [
    "I had eggs for breakfast",
    "What should I eat next?",
    "Am I on track today?",
  ]

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 mr-3 mt-1">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">r</span>
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                )}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>

                {message.mealData && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="font-medium text-sm">{message.mealData.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {message.mealData.calories} cal · {message.mealData.protein}g protein
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Pending meal confirmation */}
          {pendingMeal && (
            <div className="flex justify-start">
              <div className="flex-shrink-0 mr-3 mt-1">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">r</span>
                </div>
              </div>

              <div className="max-w-[85%] bg-card border border-border rounded-2xl p-4">
                {/* Meal preview */}
                <div className="mb-4">
                  <p className="font-medium text-foreground">{pendingMeal.name}</p>
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    <span>{pendingMeal.calories} cal</span>
                    <span>{pendingMeal.protein}g protein</span>
                    <span>{pendingMeal.carbs}g carbs</span>
                    <span>{pendingMeal.fat}g fat</span>
                  </div>
                </div>

                {/* Meal type selector */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedMealType(type)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all capitalize",
                        selectedMealType === type
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={confirmMeal}
                    disabled={isLogging}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {isLogging ? (
                      <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Log meal
                  </button>
                  <button
                    onClick={cancelMeal}
                    disabled={isLogging}
                    className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex-shrink-0 mr-3 mt-1">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">r</span>
                </div>
              </div>
              <div className="rounded-2xl bg-card border border-border px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-6 py-4">
          {/* Quick suggestions */}
          {messages.length <= 1 && !pendingMeal && (
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 rounded-2xl bg-background border border-border px-4 py-3 focus-within:border-primary/50 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={pendingMeal ? "Choose a meal type above..." : "I had a chicken salad..."}
                disabled={!!pendingMeal}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || !!pendingMeal}
                className={cn(
                  "rounded-xl p-2.5 transition-all",
                  input.trim() && !pendingMeal
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
