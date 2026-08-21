<script setup lang="ts">
  import { useRouter } from 'vue-router'
  const router = useRouter()
</script>

<template>
  <section class="py-6 py-md-12">
    <v-row align="center" justify="space-between"><v-col cols="12" md="7">
      <v-chip color="primary" variant="tonal">{{ $t('inspection_service_label') }}</v-chip>
      <h1 class="text-h3 font-weight-bold mt-5 mb-4">{{ $t('inspection_service_title') }}</h1>
      <p class="text-h6 text-medium-emphasis font-weight-regular">{{ $t('inspection_service_description') }}</p>
      <div class="d-flex flex-wrap ga-3 mt-7"><v-btn color="primary" prepend-icon="mdi-car-search" @click="router.push('/services/inspection/dashboard')">{{ $t('inspection_start_renewal') }}</v-btn><v-btn prepend-icon="mdi-login" to="/services/inspection/login" variant="tonal">{{ $t('inspection_sign_in') }}</v-btn></div>
    </v-col></v-row>
  </section>
</template>
