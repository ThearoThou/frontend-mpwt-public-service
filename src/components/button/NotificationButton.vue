<script lang="ts" setup>
  import { useRouter } from 'vue-router'
  import { useNotificationStore } from '@/stores/notification'

  const router = useRouter()
  const store = useNotificationStore()

  // Use computed from store
  const { unreadCount } = store

  function goToNotifications () {
    router.push('/notification')
  }

  // Load unread count on mount
  store.loadNotifications()
</script>

<template>
  <v-btn
    aria-label="Notifications"
    icon
    variant="text"
    @click="goToNotifications"
  >
    <v-badge
      color="error"
      :content="unreadCount"
      :value="unreadCount > 0"
    >
      <v-icon>mdi-bell</v-icon>
    </v-badge>
  </v-btn>
</template>
