<template>
  <div class="d-flex align-center">
    <v-icon class="mr-2" color="primary">carbon:batch-job-step</v-icon>
    <h4 class="text-h5 font-weight-bold mb-0">{{ $t('serviceTracking') }}</h4>
  </div>
  <p class="text-body-1 my-4">
    ដើម្បីដាក់ពាក្យប្រឡងយកប័ណ្ណបើកបរថ្មី ឬបន្ដ អ្នកត្រូវតែមានអាយុចាប់ពី ១៨ ឆ្នាំឡើងទៅ សម្រាប់ប័ណ្ណបើកបរថ្មី និងមានប័ណ្ណបើកបរដែលមានសុពលភាពសម្រាប់ការបន្ដ។ អ្នកត្រូវតែមានឯកសារដែលតម្រូវដោយផ្លូវការដូចជា រូបថតអត្តសញ្ញាណ ប័ណ្ណសម្គាល់ជនជាតិ និងឯកសារផ្សេងៗដែលទាក់ទង។
  </p>
  <v-btn
    append-icon="lucide:arrow-right"
    class="mt-4"
    color="primary"
    variant="tonal"
    @click="getStarted"
  >
    ចាប់ផ្ដើមដាក់ពាក្យ
  </v-btn>
</template>
<script lang="ts" setup>
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  const router = useRouter()

  // on click getstarted function => redirect to form page
  function getStarted () {
    router.push('/apps/service-tracking/form')
  }
</script>
