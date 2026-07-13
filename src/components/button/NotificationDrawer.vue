<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'
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

  const drawer = ref(false)
  const currentTab = ref<'all' | 'unread' | 'archived'>('all')
  const notifications = ref<Notification[]>([])
  const page = ref(1)
  const loading = ref(false)
  const hasMore = ref(true)
  const totalCount = ref(0)
  const scrollContainer = ref<HTMLElement | null>(null)

  const unreadCount = computed(() => {
    return notifications.value.filter((n: Notification) => !n.read && !n.archived).length
  })

  watch(currentTab, () => {
    notifications.value = []
    page.value = 1
    hasMore.value = true
    loadNotifications()
  })

  watch(drawer, newVal => {
    if (newVal && notifications.value.length === 0) {
      loadNotifications()
    }
  })

  async function loadNotifications () {
    if (loading.value || !hasMore.value) return

    loading.value = true
    try {
      const { data, total, hasMore: more } = await fetchNotifications(
        page.value,
        5,
        currentTab.value,
      )
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

  function handleScroll (event: Event) {
    const target = event.target as HTMLElement
    const threshold = 100
    const isNearBottom = target.scrollHeight - (target.scrollTop + target.clientHeight) < threshold

    if (isNearBottom && !loading.value && hasMore.value) {
      loadNotifications()
    }
  }

  async function onMarkAsRead (notification: Notification) {
    try {
      await markAsRead(notification.id)
      notification.read = true
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  async function onMarkAllAsRead () {
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

  async function onDeleteNotification (notificationId: number) {
    try {
      await deleteNotification(notificationId)
      notifications.value = notifications.value.filter((n: Notification) => n.id !== notificationId)
      totalCount.value--
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  async function onDeleteAllNotifications () {
    try {
      await deleteAllNotifications()
      notifications.value = []
      totalCount.value = 0
    } catch (error) {
      console.error('Failed to delete all notifications:', error)
    }
  }

  async function onArchiveNotification (notification: Notification) {
    try {
      await archiveNotification(notification.id)
      notification.archived = true
      notifications.value = notifications.value.filter((n: Notification) => n.id !== notification.id)
      totalCount.value--
    } catch (error) {
      console.error('Failed to archive notification:', error)
    }
  }

  async function onRestoreNotification (notification: Notification) {
    try {
      await restoreNotification(notification.id)
      notification.archived = false
      notifications.value = notifications.value.filter((n: Notification) => n.id !== notification.id)
      totalCount.value--
    } catch (error) {
      console.error('Failed to restore notification:', error)
    }
  }

  function formatTime (date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60_000)
    const diffHours = Math.floor(diffMs / 3_600_000)
    const diffDays = Math.floor(diffMs / 86_400_000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  function getTypeColor (type: string): string {
    switch (type) {
      case 'success': {
        return 'success'
      }
      case 'warning': {
        return 'warning'
      }
      case 'error': {
        return 'error'
      }
      default: {
        return 'info'
      }
    }
  }
</script>

<template>
  <div>
    <v-btn
      icon
      @click="drawer = !drawer"
    >
      <v-badge
        color="error"
        :content="unreadCount"
        :value="unreadCount > 0"
      >
        <v-icon>mdi-bell</v-icon>
      </v-badge>
    </v-btn>

    <v-navigation-drawer
      v-model="drawer"
      class="notification-drawer"
      temporary
      width="450"
    >
      <template #prepend>
        <v-toolbar color="primary">
          <v-toolbar-title class="text-white">Notifications</v-toolbar-title>
          <v-spacer />
          <v-btn icon size="small" @click="drawer = false">
            <v-icon class="text-white">mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
      </template>
      <v-tabs v-model="currentTab" class="mt-0" grow>
        <v-tab value="all">
          All
          <v-badge class="ml-1" :content="totalCount" inline />
        </v-tab>
        <v-tab value="unread">
          Unread
          <v-badge class="ml-1" :content="unreadCount" inline />
        </v-tab>
        <v-tab value="archived">Archived</v-tab>
      </v-tabs>

      <v-divider />

      <v-toolbar class="px-2 py-1" dense flat>
        <v-spacer />
        <v-tooltip text="Mark all as read">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :disabled="notifications.length === 0 || currentTab === 'archived'"
              icon
              size="small"
              @click="onMarkAllAsRead"
            >
              <v-icon size="small">mdi-check-all</v-icon>
            </v-btn>
          </template>
        </v-tooltip>

        <v-tooltip text="Delete all">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :disabled="notifications.length === 0"
              icon
              size="small"
              @click="onDeleteAllNotifications"
            >
              <v-icon size="small">mdi-trash-can</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </v-toolbar>

      <v-divider />

      <div
        ref="scrollContainer"
        class="notifications-scroll"
        @scroll="handleScroll"
      >
        <div v-if="notifications.length === 0 && !loading" class="pa-6 text-center">
          <v-icon class="mb-4" color="grey" size="56">mdi-bell-off</v-icon>
          <p class="text-grey">No notifications</p>
        </div>

        <div v-for="notification in notifications" :key="notification.id" class="px-3 py-2">
          <v-card
            :class="[
              'notification-item',
              !notification.read ? 'unread' : '',
            ]"
            :color="notification.read ? '' : 'blue-50'"
            elevation="1"
            variant="flat"
          >
            <v-card-item class="pa-3">
              <div class="d-flex align-start gap-3">
                <v-icon
                  class="mt-1 flex-shrink-0"
                  :color="getTypeColor(notification.type)"
                  size="small"
                >
                  {{ notification.icon }}
                </v-icon>

                <div class="flex-grow-1 min-w-0">
                  <div class="d-flex align-center justify-space-between gap-2 mb-1">
                    <h4 class="text-subtitle-2 font-weight-bold truncate">
                      {{ notification.title }}
                    </h4>
                    <span class="text-caption text-grey-darken-1 flex-shrink-0">
                      {{ formatTime(notification.timestamp) }}
                    </span>
                  </div>
                  <p class="text-body-2 text-grey-darken-1 mb-2 line-clamp-2">
                    {{ notification.message }}
                  </p>

                  <div class="d-flex gap-1 flex-wrap">
                    <v-btn
                      v-if="!notification.read && currentTab !== 'archived'"
                      size="x-small"
                      variant="tonal"
                      @click="onMarkAsRead(notification)"
                    >
                      <v-icon class="mr-1" size="x-small">mdi-check</v-icon>
                      Read
                    </v-btn>

                    <v-btn
                      v-if="currentTab !== 'archived'"
                      size="x-small"
                      variant="tonal"
                      @click="onArchiveNotification(notification)"
                    >
                      <v-icon class="mr-1" size="x-small">mdi-archive</v-icon>
                      Archive
                    </v-btn>

                    <v-btn
                      v-if="currentTab === 'archived'"
                      size="x-small"
                      variant="tonal"
                      @click="onRestoreNotification(notification)"
                    >
                      <v-icon class="mr-1" size="x-small">mdi-undo</v-icon>
                      Restore
                    </v-btn>

                    <v-btn
                      color="error"
                      size="x-small"
                      variant="tonal"
                      @click="onDeleteNotification(notification.id)"
                    >
                      <v-icon class="mr-1" size="x-small">mdi-delete</v-icon>
                      Delete
                    </v-btn>
                  </div>
                </div>
              </div>
            </v-card-item>
          </v-card>
        </div>

        <div v-if="loading" class="pa-6 text-center">
          <v-progress-circular indeterminate size="40" />
          <p class="text-grey mt-2">Loading...</p>
        </div>

        <div v-if="!hasMore && notifications.length > 0" class="pa-4 text-center">
          <p class="text-caption text-grey">No more notifications</p>
        </div>
      </div>
    </v-navigation-drawer>
  </div>
</template>

<style scoped lang="scss">
.notification-drawer {
  .notifications-scroll {
    height: calc(100vh - 280px);
    overflow-y: auto;
    overflow-x: hidden;
  }

  .notification-item {
    transition: all 0.2s ease;
    cursor: pointer;
    border-radius: 8px;

    &.unread {
      border-left: 4px solid currentColor;
    }

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
    }
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-clamp: 2;
    overflow: hidden;
  }

  .truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .min-w-0 {
    min-width: 0;
  }
}
</style>
