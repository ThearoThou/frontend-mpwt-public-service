<script setup lang="ts">
  import InspectionFooter from '@/modules/inspection/shared/components/InspectionFooter.vue'
  import InspectionHeader from '@/modules/inspection/shared/components/InspectionHeader.vue'
  import InspectionSidebar from '@/modules/inspection/shared/components/InspectionSidebar.vue'
  const drawer = ref(true)
</script>

<template>
  <v-layout class="inspection-layout" full-height>
    <InspectionSidebar v-model="drawer" />
    <InspectionHeader @toggle-navigation="drawer = !drawer" />

    <v-main class="inspection-main">
      <v-container class="inspection-page py-5 px-4 px-md-6" fluid>
        <div class="inspection-content mx-auto">
          <router-view :key="$route.fullPath" />
        </div>
      </v-container>

      <InspectionFooter />
    </v-main>
  </v-layout>
</template>

<style scoped>
  .inspection-layout {
    min-height: 100vh;
  }

  .inspection-main {
    background: #fbf9fd;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    position: relative;
  }

  .inspection-page {
    flex: 1 0 auto;
    position: relative;
  }

  .inspection-content {
    max-width: 1180px;
  }

  /* Match citizen screen content to the auth typography scale. Page h1 titles
     intentionally remain under each view's existing responsive title rules. */
  .inspection-content :deep(.citizen-auth-type-scale) { font-size: .95rem; }
  .inspection-content :deep(.citizen-auth-type-scale p),
  .inspection-content :deep(.citizen-auth-type-scale strong),
  .inspection-content :deep(.citizen-auth-type-scale li),
  .inspection-content :deep(.citizen-auth-type-scale time),
  .inspection-content :deep(.citizen-auth-type-scale small),
  .inspection-content :deep(.citizen-auth-type-scale dd),
  .inspection-content :deep(.citizen-auth-type-scale td) { font-size: .95rem !important; }
  .inspection-content :deep(.citizen-auth-type-scale dt),
  .inspection-content :deep(.citizen-auth-type-scale th),
  .inspection-content :deep(.citizen-auth-type-scale .v-label),
  .inspection-content :deep(.citizen-auth-type-scale .v-breadcrumbs-item) { font-size: .9rem !important; }
  .inspection-content :deep(.citizen-auth-type-scale .v-label.v-field-label--floating),
  .inspection-content :deep(.citizen-auth-type-scale .v-messages) { font-size: .75rem !important; }
  .inspection-content :deep(.citizen-auth-type-scale .v-field__input),
  .inspection-content :deep(.citizen-auth-type-scale .v-select__selection-text) { font-size: .95rem !important; }
  .inspection-content :deep(.citizen-auth-type-scale .v-btn),
  .inspection-content :deep(.citizen-auth-type-scale .v-chip) { font-size: .85rem !important; }
  .inspection-content :deep(.citizen-auth-type-scale .v-alert) { font-size: .9rem !important; }
</style>
