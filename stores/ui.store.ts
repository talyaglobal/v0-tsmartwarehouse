/**
 * UI Store
 * Manages global UI state (theme, sidebar, modals, etc.)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  // Sidebar state
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  // Theme
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void

  // Modals
  modals: Record<string, boolean>
  openModal: (modalId: string) => void
  closeModal: (modalId: string) => void
  closeAllModals: () => void

  // Notifications
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    duration?: number
  }>
  addNotification: (notification: Omit<UIState['notifications'][0], 'id'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void

  // Loading states
  loadingStates: Record<string, boolean>
  setLoading: (key: string, isLoading: boolean) => void
  isLoading: (key: string) => boolean
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Sidebar
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Modals
      modals: {},
      openModal: (modalId) =>
        set((state) => ({
          modals: { ...state.modals, [modalId]: true },
        })),
      closeModal: (modalId) =>
        set((state) => {
          const newModals = { ...state.modals }
          delete newModals[modalId]
          return { modals: newModals }
        }),
      closeAllModals: () => set({ modals: {} }),

      // Notifications
      notifications: [],
      addNotification: (notification) => {
        const id = Math.random().toString(36).substring(7)
        set((state) => ({
          notifications: [...state.notifications, { ...notification, id }],
        }))

        // Auto-remove after duration (default 5 seconds)
        const duration = notification.duration ?? 5000
        if (duration > 0) {
          setTimeout(() => {
            get().removeNotification(id)
          }, duration)
        }
      },
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),

      // Loading states
      loadingStates: {},
      setLoading: (key, isLoading) =>
        set((state) => ({
          loadingStates: { ...state.loadingStates, [key]: isLoading },
        })),
      isLoading: (key) => get().loadingStates[key] ?? false,
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
      }),
    }
  )
)

