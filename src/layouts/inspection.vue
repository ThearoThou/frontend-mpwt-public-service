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
          <router-view />
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
  }

  .inspection-page {
    flex: 1 0 auto;
  }

  .inspection-content {
    max-width: 1180px;
  }

</style>
