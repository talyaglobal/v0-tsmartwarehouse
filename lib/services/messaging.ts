/**
 * Messaging Service
 *
 * Handles conversations and messages management
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Conversation, Message } from '@/types/marketplace'
import { createNotification } from '@/lib/db/notifications'

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
 * Send a message.
 * receiver_id is derived from conversation: guest receives when host/staff sends, host receives when guest sends.
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

  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('host_id, guest_id')
    .eq('id', conversationId)
    .single()

  if (convError || !conv) {
    throw new Error('Conversation not found')
  }

  const receiverId = conv.guest_id === senderId ? conv.host_id : conv.guest_id

  try {
    const { data: message, error } = await supabase
      .from('warehouse_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        receiver_id: receiverId,
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

/**
 * Resolve a representative host user_id for a warehouse (for conversation host_id).
 * Priority: (1) warehouse_staff with role manager, (2) any warehouse_staff, (3) company admin for owner_company_id.
 */
export async function resolveHostForWarehouse(warehouseId: string): Promise<string | null> {
  const supabase = createServerSupabaseClient()

  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('owner_company_id')
    .eq('id', warehouseId)
    .single()

  if (!warehouse?.owner_company_id) {
    return null
  }

  const { data: managerStaff } = await supabase
    .from('warehouse_staff')
    .select('user_id')
    .eq('warehouse_id', warehouseId)
    .eq('status', true)
    .eq('role', 'manager')
    .limit(1)
    .maybeSingle()

  if (managerStaff?.user_id) {
    return managerStaff.user_id
  }

  const { data: anyStaff } = await supabase
    .from('warehouse_staff')
    .select('user_id')
    .eq('warehouse_id', warehouseId)
    .eq('status', true)
    .limit(1)
    .maybeSingle()

  if (anyStaff?.user_id) {
    return anyStaff.user_id
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_id', warehouse.owner_company_id)
    .in('role', ['root', 'warehouse_owner', 'warehouse_admin', 'warehouse_supervisor'])
    .limit(1)
    .maybeSingle()

  return adminProfile?.id ?? null
}

/**
 * Get conversations for a warehouse-side user (staff or company admin).
 * Returns conversations where warehouse_id is in the user's assigned/owned warehouses.
 */
export async function getConversationsForWarehouseUser(userId: string): Promise<Conversation[]> {
  const supabase = createServerSupabaseClient()

  const warehouseIds: string[] = []

  const { data: staffRows } = await supabase
    .from('warehouse_staff')
    .select('warehouse_id')
    .eq('user_id', userId)
    .eq('status', true)

  if (staffRows?.length) {
    warehouseIds.push(...staffRows.map((r: { warehouse_id: string }) => r.warehouse_id))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.company_id) {
    const { data: companyWarehouses } = await supabase
      .from('warehouses')
      .select('id')
      .eq('owner_company_id', profile.company_id)

    if (companyWarehouses?.length) {
      companyWarehouses.forEach((w: { id: string }) => {
        if (!warehouseIds.includes(w.id)) warehouseIds.push(w.id)
      })
    }
  }

  if (warehouseIds.length === 0) {
    return []
  }

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
    .in('warehouse_id', warehouseIds)
    .eq('status', true)
    .order('last_message_at', { ascending: false })

  if (error) {
    console.error('[messaging] Error fetching warehouse conversations:', error)
    return []
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
    unread_count: conv.host_unread_count ?? 0,
    created_at: conv.created_at,
    updated_at: conv.updated_at,
  }))
}

/**
 * Check if a user can access a conversation (is guest, host, or warehouse staff/admin for that warehouse).
 */
export async function canUserAccessConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const supabase = createServerSupabaseClient()

  const { data: conv, error } = await supabase
    .from('conversations')
    .select('host_id, guest_id, warehouse_id')
    .eq('id', conversationId)
    .single()

  if (error || !conv) {
    return false
  }

  if (conv.host_id === userId || conv.guest_id === userId) {
    return true
  }

  const { data: staff } = await supabase
    .from('warehouse_staff')
    .select('user_id')
    .eq('warehouse_id', conv.warehouse_id)
    .eq('user_id', userId)
    .eq('status', true)
    .maybeSingle()

  if (staff?.user_id) {
    return true
  }

  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('owner_company_id')
    .eq('id', conv.warehouse_id)
    .single()

  if (!warehouse?.owner_company_id) {
    return false
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('company_id', warehouse.owner_company_id)
    .in('role', ['root', 'warehouse_owner', 'warehouse_admin', 'warehouse_supervisor'])
    .maybeSingle()

  return !!profile?.id
}

/**
 * Notify all warehouse-side users (staff + company admins) that a client started a chat for a booking.
 */
export async function notifyWarehouseSideForNewChat(
  conversationId: string,
  bookingId: string,
  warehouseId: string
): Promise<void> {
  const supabase = createServerSupabaseClient()
  const notified = new Set<string>()

  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('name, owner_company_id')
    .eq('id', warehouseId)
    .single()

  if (!warehouse) return

  const { data: staffRows } = await supabase
    .from('warehouse_staff')
    .select('user_id')
    .eq('warehouse_id', warehouseId)
    .eq('status', true)

  if (staffRows?.length) {
    staffRows.forEach((r: { user_id: string }) => notified.add(r.user_id))
  }

  if (warehouse.owner_company_id) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', warehouse.owner_company_id)
      .in('role', ['root', 'warehouse_owner', 'warehouse_admin', 'warehouse_supervisor'])

    if (profiles?.length) {
      profiles.forEach((p: { id: string }) => notified.add(p.id))
    }
  }

  const title = 'New chat started'
  const message = `A client started a chat for booking ${bookingId}. Open Chats to reply.`
  const metadata = { conversationId, bookingId, warehouseId }

  for (const userId of notified) {
    try {
      await createNotification({
        userId,
        type: 'booking',
        channel: 'push',
        title,
        message,
        metadata,
      })
    } catch (err) {
      console.error('[messaging] Failed to notify user', userId, err)
    }
  }
}

