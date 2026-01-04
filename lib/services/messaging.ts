/**
 * Messaging Service
 * 
 * Handles conversations and messages management
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Conversation, Message } from '@/types/marketplace'

/**
 * Get conversations for a user
 */
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  const supabase = createServerSupabaseClient()

  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(
        `
        *,
        warehouses(id, name),
        profiles!conversations_host_id_fkey(id, name),
        profiles!conversations_guest_id_fkey(id, name)
      `
      )
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .eq('status', true)
      .order('last_message_at', { ascending: false })

    if (error) {
      throw error
    }

    return (conversations || []).map((conv: any) => ({
      id: conv.id,
      booking_id: conv.booking_id,
      warehouse_id: conv.warehouse_id,
      warehouse_name: conv.warehouses?.name || '',
      host_id: conv.host_id,
      host_name: conv.profiles?.name || '',
      guest_id: conv.guest_id,
      guest_name: conv.profiles?.name || '',
      subject: conv.subject,
      status: conv.conversation_status,
      last_message_at: conv.last_message_at,
      last_message_preview: conv.last_message_preview,
      unread_count: conv.host_id === userId ? conv.host_unread_count : conv.guest_unread_count,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    }))
  } catch (error) {
    console.error('[messaging] Error fetching conversations:', error)
    return []
  }
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  limit = 50,
  offset = 0
): Promise<{ messages: Message[]; total: number }> {
  const supabase = createServerSupabaseClient()

  try {
    const { data: messages, error, count } = await supabase
      .from('warehouse_messages')
      .select(
        `
        *,
        profiles!warehouse_messages_sender_id_fkey(id, name, avatar_url)
      `,
        { count: 'exact' }
      )
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    const transformedMessages: Message[] = (messages || []).map((m: any) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      sender_name: m.profiles?.name || 'Anonymous',
      sender_avatar: m.profiles?.avatar_url,
      content: m.content,
      message_type: m.message_type || 'text',
      attachments: m.attachments || [],
      metadata: m.metadata || {},
      is_read: !!m.read_at,
      read_at: m.read_at,
      is_deleted: m.is_deleted,
      created_at: m.created_at,
    }))

    return {
      messages: transformedMessages.reverse(), // Reverse to show oldest first
      total: count || 0,
    }
  } catch (error) {
    console.error('[messaging] Error fetching messages:', error)
    return { messages: [], total: 0 }
  }
}

/**
 * Create or get conversation
 */
export async function getOrCreateConversation(
  warehouseId: string,
  hostId: string,
  guestId: string,
  bookingId?: string
): Promise<Conversation> {
  const supabase = createServerSupabaseClient()

  try {
    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('host_id', hostId)
      .eq('guest_id', guestId)
      .eq('status', true)
      .single()

    if (existing) {
      // Fetch full conversation with related data
      const { data: fullConv } = await supabase
        .from('conversations')
        .select(
          `
          *,
          warehouses(id, name),
          profiles!conversations_host_id_fkey(id, name),
          profiles!conversations_guest_id_fkey(id, name)
        `
        )
        .eq('id', existing.id)
        .single()

      return {
        id: fullConv.id,
        booking_id: fullConv.booking_id,
        warehouse_id: fullConv.warehouse_id,
        warehouse_name: fullConv.warehouses?.name || '',
        host_id: fullConv.host_id,
        host_name: fullConv.profiles?.name || '',
        guest_id: fullConv.guest_id,
        guest_name: fullConv.profiles?.name || '',
        subject: fullConv.subject,
        status: fullConv.conversation_status,
        last_message_at: fullConv.last_message_at,
        last_message_preview: fullConv.last_message_preview,
        unread_count: 0,
        created_at: fullConv.created_at,
        updated_at: fullConv.updated_at,
      }
    }

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        warehouse_id: warehouseId,
        host_id: hostId,
        guest_id: guestId,
        booking_id: bookingId,
      })
      .select(
        `
        *,
        warehouses(id, name),
        profiles!conversations_host_id_fkey(id, name),
        profiles!conversations_guest_id_fkey(id, name)
      `
      )
      .single()

    if (error) {
      throw error
    }

    return {
      id: newConv.id,
      booking_id: newConv.booking_id,
      warehouse_id: newConv.warehouse_id,
      warehouse_name: newConv.warehouses?.name || '',
      host_id: newConv.host_id,
      host_name: newConv.profiles?.name || '',
      guest_id: newConv.guest_id,
      guest_name: newConv.profiles?.name || '',
      subject: newConv.subject,
      status: newConv.conversation_status,
      last_message_at: newConv.last_message_at,
      last_message_preview: newConv.last_message_preview,
      unread_count: 0,
      created_at: newConv.created_at,
      updated_at: newConv.updated_at,
    }
  } catch (error) {
    console.error('[messaging] Error creating conversation:', error)
    throw error
  }
}

/**
 * Send a message
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  messageType: Message['message_type'] = 'text',
  attachments?: Message['attachments'],
  metadata?: Record<string, any>
): Promise<Message> {
  const supabase = createServerSupabaseClient()

  try {
    const { data: message, error } = await supabase
      .from('warehouse_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        receiver_id: senderId, // Will be updated by trigger
        content,
        message_type: messageType,
        attachments: attachments || [],
        metadata: metadata || {},
      })
      .select(
        `
        *,
        profiles!warehouse_messages_sender_id_fkey(id, name, avatar_url)
      `
      )
      .single()

    if (error) {
      throw error
    }

    // The trigger will automatically update the conversation

    return {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      sender_name: message.profiles?.name || 'Anonymous',
      sender_avatar: message.profiles?.avatar_url,
      content: message.content,
      message_type: message.message_type,
      attachments: message.attachments || [],
      metadata: message.metadata || {},
      is_read: false,
      is_deleted: false,
      created_at: message.created_at,
    }
  } catch (error) {
    console.error('[messaging] Error sending message:', error)
    throw error
  }
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = createServerSupabaseClient()

  try {
    const { error } = await supabase
      .from('warehouse_messages')
      .update({
        read_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .eq('receiver_id', userId)
      .is('read_at', null)

    if (error) {
      throw error
    }

    // Update conversation unread count
    const { data: conv } = await supabase
      .from('conversations')
      .select('host_id, guest_id')
      .eq('id', conversationId)
      .single()

    if (conv) {
      const isHost = conv.host_id === userId
      await supabase
        .from('conversations')
        .update({
          [isHost ? 'host_unread_count' : 'guest_unread_count']: 0,
        })
        .eq('id', conversationId)
    }
  } catch (error) {
    console.error('[messaging] Error marking messages as read:', error)
    throw error
  }
}

/**
 * Get unread message count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createServerSupabaseClient()

  try {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('host_unread_count, guest_unread_count, host_id, guest_id')
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .eq('status', true)

    if (!conversations) {
      return 0
    }

    return conversations.reduce((total, conv) => {
      if (conv.host_id === userId) {
        return total + (conv.host_unread_count || 0)
      } else {
        return total + (conv.guest_unread_count || 0)
      }
    }, 0)
  } catch (error) {
    console.error('[messaging] Error getting unread count:', error)
    return 0
  }
}

