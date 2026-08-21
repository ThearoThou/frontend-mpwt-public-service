<script setup lang="ts">
  defineProps<{ title: string, description: string }>()
</script>

<template>
  <!-- eslint-disable vue/padding-line-between-tags -->
  <section>
    <h1 class="text-h4 font-weight-bold mb-3">{{ $t(title) }}</h1>
    <v-card border class="pa-6" elevation="0" rounded="lg">
      <p class="text-body-1 text-medium-emphasis mb-0">{{ $t(description) }}</p>
    </v-card>
  </section>
</template>
