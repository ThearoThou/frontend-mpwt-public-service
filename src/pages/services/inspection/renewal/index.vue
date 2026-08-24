<route lang="json">
{ "meta": { "layout": "inspection", "requiresInspectionAuth": true, "redirectGuestToInspectionLogin": true } }
</route>

<script setup lang="ts">
  import RenewalEntryView from '@/modules/inspection/citizen/renewal/RenewalEntryView.vue'
</script>

<template>
  <RenewalEntryView />
</template>
