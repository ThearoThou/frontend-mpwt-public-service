<script setup lang="ts">
  const drawer = ref(true)
</script>

<template>
  <v-layout class="inspection-layout" full-height>
    <InspectionSidebar v-model="drawer" />

    <v-main class="bg-grey-lighten-4">
      <InspectionHeader @toggle-navigation="drawer = !drawer" />

      <v-container class="py-8 px-4 px-md-8" fluid>
        <div class="inspection-content mx-auto">
          <router-view />
        </div>
      </v-container>
    </v-main>
  </v-layout>
</template>

<style scoped>
  .inspection-layout {
    min-height: 100vh;
  }

  .inspection-content {
    max-width: 1440px;
  }
</style>
