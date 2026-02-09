"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { MessageSquare, Send, Loader2 } from "@/components/icons"
import { api } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/format"
import { useUser } from "@/lib/hooks/use-user"
import type { Conversation, Message } from "@/types/marketplace"

export default function DashboardChatsPage() {
  const searchParams = useSearchParams()
  const { user } = useUser()
  const conversationIdFromUrl = searchParams?.get("conversation") ?? null

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(conversationIdFromUrl)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sendContent, setSendContent] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const selectedConversation = conversations.find((c) => c.id === selectedId)

  const fetchConversations = useCallback(async () => {
    setConversationsLoading(true)
    try {
      const res = await api.get<Conversation[]>("/api/v1/conversations", { showToast: false })
      if (res.success && res.data) {
        setConversations(res.data)
      }
    } finally {
      setConversationsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    setSelectedId((prev) => conversationIdFromUrl || prev)
  }, [conversationIdFromUrl])

  const fetchMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true)
    try {
      const res = await api.get<{ messages: Message[]; total: number }>(
        `/api/v1/conversations/${convId}/messages`,
        { showToast: false }
      )
      if (res.success && res.data) {
        setMessages(res.data.messages ?? [])
      } else {
        setMessages([])
      }
      await api.patch(`/api/v1/conversations/${convId}/read`, {}, { showToast: false })
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId)
    } else {
      setMessages([])
    }
  }, [selectedId, fetchMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    const content = sendContent.trim()
    if (!content || !selectedId || sending) return

    setSending(true)
    setSendContent("")
    try {
      const res = await api.post<Message>(`/api/v1/conversations/${selectedId}/messages`, { content }, { showToast: false })
      if (res.success && res.data) {
        setMessages((prev) => [...prev, res.data!])
      } else {
        api.showToast?.("Failed to send message", "error")
      }
      fetchConversations()
    } catch {
      api.showToast?.("Failed to send message", "error")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chats"
        description="Conversations with warehouse staff"
        backButton
        backHref="/dashboard/bookings"
      />

      <div className={cn("grid gap-4", "grid-cols-1 md:grid-cols-[320px_1fr]")}>
        <Card className="flex flex-col h-[calc(100vh-12rem)] min-h-[320px]">
          <div className="p-2 border-b">
            <h3 className="font-medium text-sm text-muted-foreground">Conversations</h3>
          </div>
          {conversationsLoading ? (
            <div className="flex items-center justify-center flex-1 p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-4 text-center text-muted-foreground text-sm">
              <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
              <p>No conversations yet.</p>
              <p className="mt-1">Start a chat from a booking (Chat with warehouse staff).</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <ul className="p-2 space-y-1">
                {conversations.map((conv) => {
                  const isSelected = conv.id === selectedId
                  const otherName =
                    user?.id === conv.guest_id
                      ? conv.host_name || conv.warehouse_name || "Warehouse"
                      : conv.guest_name || conv.warehouse_name || "Chat"
                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(conv.id)}
                        className={cn(
                          "w-full text-left rounded-lg p-3 transition-colors",
                          isSelected
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/60 border border-transparent"
                        )}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-medium text-sm truncate">{otherName}</span>
                          {conv.last_message_at && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDate(conv.last_message_at)}
                            </span>
                          )}
                        </div>
                        {conv.last_message_preview && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {conv.last_message_preview}
                          </p>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="inline-flex mt-1 text-xs font-medium text-primary">
                            {conv.unread_count} new
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          )}
        </Card>

        <Card className="flex flex-col h-[calc(100vh-12rem)] min-h-[320px]">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p>Select a conversation or start one from a booking.</p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {selectedConversation?.warehouse_name || selectedConversation?.guest_name || selectedConversation?.host_name || "Chat"}
                </span>
              </div>

              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id
                      return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className="text-xs opacity-80 mt-1">
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )})}
                    <div ref={scrollRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="p-3 border-t flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={sendContent}
                  onChange={(e) => setSendContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!sendContent.trim() || sending}
                  title="Send"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
      {children}
    </div>
  )
}
