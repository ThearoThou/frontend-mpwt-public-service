<script setup lang="ts">
  withDefaults(defineProps<{
    color?: 'deep-purple' | 'error' | 'info' | 'secondary' | 'success' | 'warning'
  }>(), {
    color: 'secondary',
  })
</script>

<template>
  <span :class="['inspection-status-badge', `inspection-status-badge--${color}`]"><slot /></span>
</template>

<style scoped>
  .inspection-status-badge { display: inline-flex; font-size: .88rem; font-weight: 600; line-height: 1.4; }
  .inspection-status-badge--info { color: #075985; }
  .inspection-status-badge--deep-purple, .inspection-status-badge--secondary { color: #5b21b6; }
  .inspection-status-badge--success { color: #166534; }
  .inspection-status-badge--warning { color: #8a4b00; }
  .inspection-status-badge--error { color: #b42318; }
</style>
