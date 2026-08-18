<route lang="json">
{ "meta": { "layout": "inspection", "requiresInspectionAuth": true } }
</route>

<script setup lang="ts">
  import InspectionPagePlaceholder from '@/components/inspection/InspectionPagePlaceholder.vue'
</script>

<template>
  <InspectionPagePlaceholder description="inspection_applications_placeholder" title="inspection_my_applications" />
</template>
