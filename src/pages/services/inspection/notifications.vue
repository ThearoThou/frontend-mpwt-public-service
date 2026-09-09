<route lang="json">
{ "meta": { "layout": "inspection", "requiresInspectionAuth": true } }
</route>

<script setup lang="ts">
  import InspectionNotificationsView from '@/modules/inspection/citizen/notifications/InspectionNotificationsView.vue'
</script>

<template>
  <InspectionNotificationsView />
</template>
