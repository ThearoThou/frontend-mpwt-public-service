<template>
  <v-app>
    <router-view />

    <v-snackbar v-model="inspectionAccessNotice.visible" color="warning" location="top" timeout="4000">
      {{ $t('inspection_login_required') }}
    </v-snackbar>
  </v-app>
</template>

<script lang="ts" setup>
  import { inspectionAccessNotice } from '@/modules/inspection/auth/utils/access-notice'
</script>
