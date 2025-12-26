"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Send, X, Bot, Loader2, Minus, Sparkles, Trash2, User } from "@/components/icons"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useUser } from "@/lib/hooks/use-user"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date | string
}

const STORAGE_KEY = "ai-assistant-chat-history"
const COLLAPSE_STORAGE_KEY = "ai-assistant-collapsed"

// Helper function to format timestamp (client-side only to avoid hydration issues)
const formatTimestamp = (timestamp: Date | string): string => {
  if (typeof window === "undefined") return ""
  
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp
  if (isNaN(date.getTime())) return ""
  
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Helper functions for localStorage
const loadMessagesFromStorage = (): Message[] => {
  if (typeof window === "undefined") return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const parsed = JSON.parse(stored)
    // Keep timestamps as strings to avoid hydration issues
    return parsed.map((msg: Omit<Message, "timestamp"> & { timestamp: string }) => ({
      ...msg,
      timestamp: msg.timestamp, // Keep as string
    }))
  } catch (error) {
    console.error("Error loading messages from storage:", error)
    return []
  }
}

const saveMessagesToStorage = (messages: Message[]) => {
  if (typeof window === "undefined") return
  
  try {
    // Convert Date objects to ISO strings for storage
    const messagesToStore = messages.map((msg) => ({
      ...msg,
      timestamp: typeof msg.timestamp === "string" ? msg.timestamp : msg.timestamp.toISOString(),
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToStore))
  } catch (error) {
    console.error("Error saving messages to storage:", error)
  }
}

const loadCollapseStateFromStorage = (): boolean => {
  if (typeof window === "undefined") return false
  
  try {
    const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    if (stored === null) return false // Default to not collapsed
    return JSON.parse(stored) === true
  } catch (error) {
    console.error("Error loading collapse state from storage:", error)
    return false
  }
}

const saveCollapseStateToStorage = (isCollapsed: boolean) => {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(isCollapsed))
  } catch (error) {
    console.error("Error saving collapse state to storage:", error)
  }
}

export function AIAssistant() {
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(true) // Default to open on desktop
  const [isCollapsed, setIsCollapsed] = useState(() => loadCollapseStateFromStorage()) // Load collapse state from localStorage
  const [isMounted, setIsMounted] = useState(false) // Track if component is mounted (client-side)
  
  // Fetch user avatar for chat messages
  const { data: userAvatar } = useQuery({
    queryKey: ['ai-assistant-avatar', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      const { data: profileData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!profileData) return null

      // Get avatar URL - upload API returns public URL, so use it directly
      let avatarUrl = (profileData as any)?.avatar_url || null
      
      // If avatarUrl is a storage path (not a full URL), convert it to public URL
      if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
        // If it's already a path like "avatar/xxx", use it directly
        // Otherwise, assume it's in the avatar folder
        const path = avatarUrl.startsWith('avatar/') || avatarUrl.startsWith('logo/')
          ? avatarUrl
          : `avatar/${avatarUrl}`
        
        const { data: { publicUrl } } = supabase.storage.from('docs').getPublicUrl(path)
        avatarUrl = publicUrl
      }
      
      return avatarUrl
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
  
  // Load messages from localStorage on mount
  const [messages, setMessages] = useState<Message[]>(() => {
    const storedMessages = loadMessagesFromStorage()
    // If no stored messages, show welcome message
    if (storedMessages.length === 0) {
      return [
        {
          id: "1",
          role: "assistant",
          content: "Merhaba! Size nasıl yardımcı olabilirim? Depo yönetimi, siparişler, rezervasyonlar veya başka bir konuda sorularınızı yanıtlayabilirim.",
          timestamp: new Date().toISOString(), // Store as ISO string to avoid hydration issues
        },
      ]
    }
    return storedMessages
  })
  
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Mark component as mounted (client-side only)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    saveMessagesToStorage(messages)
  }, [messages])

  // Save collapse state to localStorage whenever it changes
  useEffect(() => {
    saveCollapseStateToStorage(isCollapsed)
  }, [isCollapsed])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  // Focus input when assistant opens
  useEffect(() => {
    if (isOpen && inputRef.current && !isLoading) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isLoading])

  // Keep focus on input after messages update (when not loading)
  useEffect(() => {
    if (!isLoading && inputRef.current && isOpen && !isCollapsed) {
      // Only focus if input is not already focused
      if (document.activeElement !== inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
  }, [messages, isLoading, isOpen, isCollapsed])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(), // Store as ISO string to avoid hydration issues
    }

      setMessages((prev) => [...prev, userMessage])
      const currentInput = input.trim()
      setInput("")
      setIsLoading(true)
      
      // Keep focus on input after clearing
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)

    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: currentInput }),
      })

      const result = await response.json()

      if (result.success && result.data?.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.data.response,
          timestamp: new Date().toISOString(), // Store as ISO string to avoid hydration issues
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        throw new Error(result.error || "Failed to get response")
      }
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.",
        timestamp: new Date().toISOString(), // Store as ISO string to avoid hydration issues
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      // Focus input after sending message
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearHistory = () => {
    const welcomeMessage: Message = {
      id: "1",
      role: "assistant",
      content: "Merhaba! Size nasıl yardımcı olabilirim? Depo yönetimi, siparişler, rezervasyonlar veya başka bir konuda sorularınızı yanıtlayabilirim.",
      timestamp: new Date().toISOString(), // Store as ISO string to avoid hydration issues
    }
    setMessages([welcomeMessage])
    // localStorage will be updated by the useEffect
  }

  return (
    <>
      {/* Toggle Button - Always visible */}
      <div className="fixed bottom-6 right-6 z-50 lg:hidden">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        >
          {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        </Button>
      </div>

      {/* AI Assistant Panel */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-full border-l bg-background transition-all duration-300",
          isCollapsed ? "w-0" : "w-80 xl:w-96"
        )}
      >
        {!isCollapsed && (
          <Card className="flex flex-col h-full rounded-none border-0 border-l">
            <CardHeader className="flex-shrink-0 border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Bot className="h-5 w-5 text-primary" />
                  AI Assistant
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleClearHistory}
                    aria-label="Clear Chat History"
                    title="Sohbet Geçmişini Temizle"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsCollapsed(true)}
                    aria-label="Collapse AI Assistant"
                    title="Gizle"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {/* Messages Area */}
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="space-y-4" ref={scrollAreaRef}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      <span className="text-xs opacity-70 mt-1 block" suppressHydrationWarning>
                        {isMounted ? formatTimestamp(message.timestamp) : ""}
                      </span>
                    </div>
                    {message.role === "user" && (
                      <div className="flex-shrink-0 mt-1">
                        {userAvatar ? (
                          <>
                            <img
                              src={userAvatar}
                              alt="User"
                              className="h-8 w-8 rounded-full object-cover border"
                              onError={(e) => {
                                const img = e.currentTarget
                                img.style.display = 'none'
                                const fallback = img.nextElementSibling as HTMLElement
                                if (fallback) {
                                  fallback.classList.remove('hidden')
                                }
                              }}
                            />
                            <div className="hidden h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t p-4">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Mesajınızı yazın..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
      </aside>

      {/* Collapsed AI Assistant Button - Bottom Right */}
      {isCollapsed && (
        <div className="hidden lg:flex fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setIsCollapsed(false)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            aria-label="Open AI Assistant"
            title="AI Assistant'ı Aç"
          >
            <Sparkles className="h-6 w-6" />
          </Button>
        </div>
      )}
    </>
  )
}

