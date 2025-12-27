"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Send } from "lucide-react"
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

export default function LogPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useUser()

  const initialMessages: Message[] = [
    {
      id: "1",
      role: "assistant",
      content: `Hi ${user?.firstName || 'there'}! What did you have to eat? Just tell me what you had and I'll log it for you.`,
      timestamp: new Date(),
    },
  ]

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/auth/signin')
    }
  }, [isLoaded, isSignedIn, router])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !user?.id) return

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
      // Call the chat API to process the meal
      const response = await fetch('/api/chat-log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          userId: user.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to process message')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        mealData: data.mealLogged ? data.mealData : undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Failed to log meal:', error)

      // Show error message to user
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I had trouble processing that. Could you try again?",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  // Show loading state while checking auth
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-130px)] max-w-4xl flex-col px-6 py-8 sm:px-8 lg:px-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Log a Meal</h1>
        <p className="text-sm text-muted-foreground">Tell me what you ate and I'll track it for you</p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-white p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3",
                  message.role === "user" ? "bg-neutral-900 text-white" : "bg-muted text-foreground",
                )}
              >
                <p className="text-sm">{message.content}</p>

                {message.mealData && (
                  <div className="mt-3 rounded-lg bg-white/10 p-3">
                    <p className="mb-2 text-xs font-medium opacity-70">Logged meal</p>
                    <p className="font-medium">{message.mealData.name}</p>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="opacity-70">Cal</span>
                        <p className="font-medium">{message.mealData.calories}</p>
                      </div>
                      <div>
                        <span className="opacity-70">Protein</span>
                        <p className="font-medium">{message.mealData.protein}g</p>
                      </div>
                      <div>
                        <span className="opacity-70">Carbs</span>
                        <p className="font-medium">{message.mealData.carbs}g</p>
                      </div>
                      <div>
                        <span className="opacity-70">Fat</span>
                        <p className="font-medium">{message.mealData.fat}g</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-3">
                <div className="flex items-center gap-1">
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="I just had a chicken salad..."
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className={cn(
              "rounded-lg p-2 transition-colors",
              input.trim() ? "bg-neutral-900 text-white hover:bg-neutral-800" : "bg-muted text-muted-foreground",
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </main>
  )
}
