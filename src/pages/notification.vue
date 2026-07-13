<script lang="ts" setup>
  import type { Notification } from '@/services/notificationService'
  import { ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useNotificationStore } from '@/stores/notification'

  const router = useRouter()
  const store = useNotificationStore()
  const scrollContainer = ref<HTMLElement | null>(null)

  // Watch store properties
  const { notifications, loading, hasMore, totalCount, unreadCount } = store

  // Create a local ref for currentTab that syncs with store
  const currentTab = ref(store.currentTab)

  watch(currentTab, newTab => {
    // Update store when tab changes
    store.currentTab = newTab
    store.resetTab()
    store.loadNotifications()
  })

  function handleScroll (event: Event) {
    const target = event.target as HTMLElement
    const threshold = 100
    const isNearBottom = target.scrollHeight - (target.scrollTop + target.clientHeight) < threshold

    if (isNearBottom && !loading && hasMore) {
      store.loadNotifications()
    }
  }

  async function onMarkAsRead (notification: Notification) {
    await store.markAsReadAction(notification.id)
  }

  async function onMarkAllAsRead () {
    await store.markAllAsReadAction()
  }

  async function onDeleteNotification (notificationId: number) {
    await store.deleteNotificationAction(notificationId)
  }

  async function onDeleteAllNotifications () {
    await store.deleteAllNotificationsAction()
  }

  async function onArchiveNotification (notification: Notification) {
    await store.archiveNotificationAction(notification.id)
  }

  async function onRestoreNotification (notification: Notification) {
    await store.restoreNotificationAction(notification.id)
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

  // Load notifications on mount
  store.loadNotifications()
</script>

<template>
  <div class="notifications-page">
    <!-- Header -->
    <v-container class="py-6">
      <div class="d-flex align-center justify-space-between mb-6">
        <div>
          <h1 class="text-h4 font-weight-bold mb-2">Notifications</h1>
          <p class="text-body-1 text-grey-darken-1">
            Manage and view all your notifications in one place
          </p>
        </div>
        <v-btn icon @click="router.back()">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <!-- Tabs -->
      <v-tabs v-model="currentTab" class="mb-4" grow>
        <v-tab value="all">
          All
          <v-badge class="ml-2" :content="totalCount" inline />
        </v-tab>
        <v-tab value="unread">
          Unread
          <v-badge class="ml-2" :content="unreadCount" inline />
        </v-tab>
        <v-tab value="archived">Archived</v-tab>
      </v-tabs>

      <v-divider class="mb-4" />

      <!-- Toolbar -->
      <div class="d-flex align-center justify-space-between mb-6">
        <p class="text-body-2 text-grey-darken-1">
          {{ notifications.length }} notification{{ notifications.length !== 1 ? 's' : '' }}
        </p>
        <div class="d-flex gap-2">
          <v-tooltip text="Mark all as read">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :disabled="notifications.length === 0 || currentTab === 'archived'"
                icon
                variant="tonal"
                @click="onMarkAllAsRead"
              >
                <v-icon>mdi-check-all</v-icon>
              </v-btn>
            </template>
          </v-tooltip>

          <v-tooltip text="Delete all">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                color="error"
                :disabled="notifications.length === 0"
                icon
                variant="tonal"
                @click="onDeleteAllNotifications"
              >
                <v-icon>mdi-trash-can</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </div>
      </div>
    </v-container>

    <!-- Notifications List -->
    <v-container
      ref="scrollContainer"
      class="notifications-container"
      @scroll="handleScroll"
    >
      <!-- Empty State -->
      <div v-if="notifications.length === 0 && !loading" class="py-12 text-center">
        <v-icon class="mb-4" color="grey-lighten-1" size="80">mdi-bell-off</v-icon>
        <h3 class="text-h6 text-grey-darken-1 mb-2">No notifications</h3>
        <p class="text-body-2 text-grey">
          You're all caught up! Check back later for new updates.
        </p>
      </div>

      <!-- Notification Items -->
      <div v-for="notification in notifications" :key="notification.id" class="mb-4">
        <v-card
          class="rounded-lg"
          :class="[
            'notification-card',
            !notification.read ? 'unread' : '',
          ]"
          :color="notification.read ? '' : 'blue-50'"
          elevation="1"
          variant="flat"
        >
          <v-card-item class="pa-4">
            <div class="d-flex align-start gap-4">
              <!-- Icon -->
              <div class="flex-shrink-0">
                <v-avatar
                  class="rounded-lg"
                  :color="getTypeColor(notification.type)"
                  size="48"
                >
                  <v-icon :color="notification.read ? '' : 'white'" size="24">
                    {{ notification.icon }}
                  </v-icon>
                </v-avatar>
              </div>

              <!-- Content -->
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-center justify-space-between gap-4 mb-1">
                  <h4 class="text-h6 font-weight-bold">
                    {{ notification.title }}
                  </h4>
                  <span class="text-caption text-grey-darken-1 flex-shrink-0">
                    {{ formatTime(notification.timestamp) }}
                  </span>
                </div>
                <p class="text-body-2 text-grey-darken-1 mb-3 line-clamp-3">
                  {{ notification.message }}
                </p>

                <!-- Action Buttons -->
                <div class="d-flex gap-2 flex-wrap">
                  <v-btn
                    v-if="!notification.read && currentTab !== 'archived'"
                    size="small"
                    variant="tonal"
                    @click="onMarkAsRead(notification)"
                  >
                    <v-icon class="mr-1" size="small">mdi-check</v-icon>
                    Mark as Read
                  </v-btn>

                  <v-btn
                    v-if="currentTab !== 'archived'"
                    size="small"
                    variant="tonal"
                    @click="onArchiveNotification(notification)"
                  >
                    <v-icon class="mr-1" size="small">mdi-archive</v-icon>
                    Archive
                  </v-btn>

                  <v-btn
                    v-if="currentTab === 'archived'"
                    size="small"
                    variant="tonal"
                    @click="onRestoreNotification(notification)"
                  >
                    <v-icon class="mr-1" size="small">mdi-undo</v-icon>
                    Restore
                  </v-btn>

                  <v-btn
                    color="error"
                    size="small"
                    variant="tonal"
                    @click="onDeleteNotification(notification.id)"
                  >
                    <v-icon class="mr-1" size="small">mdi-delete</v-icon>
                    Delete
                  </v-btn>
                </div>
              </div>
            </div>
          </v-card-item>
        </v-card>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="py-12 text-center">
        <v-progress-circular class="mb-4" indeterminate size="50" />
        <p class="text-body-2 text-grey">Loading notifications...</p>
      </div>

      <!-- End of List -->
      <div v-if="!hasMore && notifications.length > 0" class="py-8 text-center">
        <p class="text-caption text-grey">No more notifications</p>
      </div>
    </v-container>
  </div>
</template>

<style scoped lang="scss">
.notifications-page {
  min-height: 100vh;
  background: rgba(0, 0, 0, 0.02);
}

.notifications-container {
  max-width: 900px;
  margin: 0 auto;
  max-height: calc(100vh - 340px);
  overflow-y: auto;
  padding-bottom: 2rem !important;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;

    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }
}

.notification-card {
  transition: all 0.3s ease;
  border-radius: 12px;

  &.unread {
    border-left: 5px solid currentColor;
  }

  &:hover {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12) !important;
    transform: translateY(-2px);
  }
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-clamp: 3;
  overflow: hidden;
}

.min-w-0 {
  min-width: 0;
}
</style>
