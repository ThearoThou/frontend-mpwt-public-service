<script setup lang="ts">
  import InspectionDetailView from '@/modules/inspection/citizen/inspection-history/InspectionDetailView.vue'
  const route = useRoute()
  const inspectionId = computed(() => (route.params as { inspectionId?: string }).inspectionId ?? '')
</script>
<template><InspectionDetailView :inspection-id="inspectionId" /></template>
