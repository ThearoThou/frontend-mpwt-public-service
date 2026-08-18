<route lang="json">
{ "meta": { "layout": "inspection", "requiresInspectionAuth": true } }
</route>

<script setup lang="ts">
  import InspectionPagePlaceholder from '@/components/inspection/InspectionPagePlaceholder.vue'
</script>

<template>
  <InspectionPagePlaceholder description="inspection_step_zero_placeholder" title="inspection_start_renewal" />
</template>
