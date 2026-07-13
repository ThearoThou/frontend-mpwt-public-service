import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  archiveNotification,
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  markAllAsRead,
  markAsRead,
  type Notification,
  restoreNotification,
} from '@/services/notificationService'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const currentTab = ref<'all' | 'unread' | 'archived'>('all')
  const page = ref(1)
  const loading = ref(false)
  const hasMore = ref(true)
  const totalCount = ref(0)

  // Computed properties
  const unreadCount = computed(() => {
    // Count ALL unread notifications across all loaded data
    // This includes unread notifications not currently visible in the current tab
    return notifications.value.filter((n: Notification) => !n.read && !n.archived).length
  })

  const archivedCount = computed(() => {
    return notifications.value.filter((n: Notification) => n.archived).length
  })

  // Actions
  async function loadNotifications () {
    if (loading.value || !hasMore.value) {
      return
    }

    loading.value = true
    try {
      const { data, total, hasMore: more } = await fetchNotifications(
        page.value,
        10,
        currentTab.value,
      )
      // Always add to notifications array
      notifications.value.push(...data)
      totalCount.value = total
      hasMore.value = more
      page.value++
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      loading.value = false
    }
  }

  function setCurrentTab (tab: 'all' | 'unread' | 'archived') {
    currentTab.value = tab
  }

  async function markAsReadAction (notificationId: number) {
    try {
      await markAsRead(notificationId)
      const notification = notifications.value.find(n => n.id === notificationId)
      if (notification) {
        notification.read = true
      }
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  async function markAllAsReadAction () {
    try {
      await markAllAsRead()
      for (const n of notifications.value) {
        if (!n.archived) {
          n.read = true
        }
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  async function deleteNotificationAction (notificationId: number) {
    try {
      await deleteNotification(notificationId)
      notifications.value = notifications.value.filter((n: Notification) => n.id !== notificationId)
      totalCount.value--
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  async function deleteAllNotificationsAction () {
    try {
      await deleteAllNotifications()
      notifications.value = []
      totalCount.value = 0
    } catch (error) {
      console.error('Failed to delete all notifications:', error)
    }
  }

  async function archiveNotificationAction (notificationId: number) {
    try {
      await archiveNotification(notificationId)
      const notification = notifications.value.find(n => n.id === notificationId)
      if (notification) {
        notification.archived = true
      }
      notifications.value = notifications.value.filter((n: Notification) => n.id !== notificationId)
      totalCount.value--
    } catch (error) {
      console.error('Failed to archive notification:', error)
    }
  }

  async function restoreNotificationAction (notificationId: number) {
    try {
      await restoreNotification(notificationId)
      const notification = notifications.value.find(n => n.id === notificationId)
      if (notification) {
        notification.archived = false
      }
      notifications.value = notifications.value.filter((n: Notification) => n.id !== notificationId)
      totalCount.value--
    } catch (error) {
      console.error('Failed to restore notification:', error)
    }
  }

  function resetTab () {
    notifications.value = []
    page.value = 1
    hasMore.value = true
    totalCount.value = 0
  }

  return {
    // State
    notifications,
    currentTab,
    page,
    loading,
    hasMore,
    totalCount,

    // Computed
    unreadCount,
    archivedCount,

    // Actions
    loadNotifications,
    markAsReadAction,
    markAllAsReadAction,
    deleteNotificationAction,
    deleteAllNotificationsAction,
    archiveNotificationAction,
    restoreNotificationAction,
    resetTab,
    setCurrentTab,
  }
})
