<template>
  <div class="d-flex align-center">
    <v-icon class="mr-2" color="primary">carbon:license-third-party-draft</v-icon>
    <h4 class="text-h5 font-weight-bold mb-0">ដាក់ពាក្យប្រឡងយកបណ្ណបើកបរ</h4>
  </div>
  <p class="text-body-1 my-4">The v-chip component is used to convey small pieces of information. Using the close
    property, the chip becomes interactive, allowing user interaction. This component is used by the v-chip-group
    for advanced selection options.
  </p>
  <div class="d-flex ga-2 mt-2">
    <v-chip size="small" @click="window = 0">
      ព័ត៌មានសង្ខេប
      <template #prepend>
        <v-icon class="mr-1" color="primary">ooui:text-summary-ltr</v-icon>
      </template>
    </v-chip>
    <v-chip size="small" @click="window = 1">
      និតិវិធីសេវា
      <template #prepend>
        <v-icon class="mr-1" color="primary">streamline-plump:steps-1-remix</v-icon>
      </template>
    </v-chip>
    <v-chip size="small" @click="window = 2">
      ឯកសារតម្រូវ
      <template #prepend>
        <v-icon class="mr-1" color="primary">pepicons-pop:file</v-icon>
      </template>
    </v-chip>
    <v-chip size="small" @click="window = 3">
      ទីតាំងផ្តល់សេវា
      <template #prepend>
        <v-icon class="mr-1" color="primary">fluent:location-12-regular</v-icon>
      </template>
    </v-chip>
    <v-chip size="small" @click="window = 4">
      ឯកសារយោង
      <template #prepend>
        <v-icon class="mr-1" color="primary">ooui:reference-existing-rtl</v-icon>
      </template>
    </v-chip>
  </div>
  <v-window v-model="window">
    <v-window-item>
      <h4 class="text-h6 font-weight-bold my-4">ព័ត៌មានសង្ខេប</h4>
      <p class="text-body-1">
        ដើម្បីដាក់ពាក្យប្រឡងយកប័ណ្ណបើកបរថ្មី ឬបន្ដ អ្នកត្រូវតែមានអាយុចាប់ពី ១៨ ឆ្នាំឡើងទៅ សម្រាប់ប័ណ្ណបើកបរថ្មី និងមានប័ណ្ណបើកបរដែលមានសុពលភាពសម្រាប់ការបន្ដ។ អ្នកត្រូវតែមានឯកសារដែលតម្រូវដោយផ្លូវការដូចជា រូបថតអត្តសញ្ញាណ ប័ណ្ណសម្គាល់ជនជាតិ និងឯកសារផ្សេងៗដែលទាក់ទង។
      </p>
    </v-window-item>
    <v-window-item>
      <h4 class="text-h6 font-weight-bold my-4">និតិវិធីសេវា</h4>
      <p class="text-body-1">
        ដើម្បីដាក់ពាក្យប្រឡងយកប័ណ្ណបើកបរថ្មី ឬបន្ដ អ្នកត្រូវតែចូលទៅកាន់គេហទំព័រផ្លូវការរបស់ក្រសួងដឹកជញ្ជូន និងធ្វើការចុះឈ្មោះ។ បន្ទាប់មក អ្នកត្រូវតែបំពេញពាក្យ និងផ្តល់ឯកសារតម្រូវ។ បន្ទាប់ពីបានដាក់ពាក្យ អ្នកនឹងត្រូវតែធ្វើការប្រឡងទាំងអស់ដែលបានកំណត់។
      </p>
    </v-window-item>
    <v-window-item>
      <h4 class="text-h6 font-weight-bold my-4">ឯកសារតម្រូវ</h4>
      <p class="text-body-1">
        ឯកសារដែលតម្រូវរួមមាន៖ រូបថតអត្តសញ្ញាណ (១) ច្បាប់សម្គាល់ជនជាតិ (២) ឯកសារបញ្ជាក់អាសយដ្ឋាន (៣) ប័ណ្ណបើកបរមុន (សម្រាប់ការបន្ដ) (៤) និងឯកសារផ្សេងៗដែលអាចត្រូវបានទាមទារ។
      </p>
    </v-window-item>
    <v-window-item>
      <h4 class="text-h6 font-weight-bold my-4">ទីតាំងផ្តល់សេវា</h4>
      <p class="text-body-1">
        អ្នកអាចដាក់ពាក្យនៅសាខាក្រសួងដឹកជញ្ជូនជិតបំផុត ឬតាមរយៈគេហទំព័រផ្លូវការរបស់ក្រសួងដឹកជញ្ជូន។
      </p>
    </v-window-item>
    <v-window-item>
      <h4 class="text-h6 font-weight-bold my-4">ឯកសារយោង</h4>
      <p class="text-body-1">
        សម្រាប់ព័ត៌មានបន្ថែម អ្នកអាចយោងទៅកាន់គេហទំព័រផ្លូវការរបស់ក្រសួងដឹកជញ្ជូន ឬទំនាក់ទំនងតាមរយៈលេខទូរស័ព្ទផ្លូវការ។
      </p>
    </v-window-item>
  </v-window>
  <!--  <div class="d-flex justify-start ga-4 mt-4">-->
  <!--    <v-btn-->
  <!--      color="primary"-->
  <!--      :disabled="window === 0"-->
  <!--      prepend-icon="ooui:previous-ltr"-->
  <!--      variant="text"-->
  <!--      @click="window&#45;&#45;"-->
  <!--    >-->
  <!--      មុន-->
  <!--    </v-btn>-->
  <!--    <v-btn-->
  <!--      append-icon="ooui:previous-rtl"-->
  <!--      color="primary"-->
  <!--      :disabled="window === 4"-->
  <!--      variant="text"-->
  <!--      @click="window++"-->
  <!--    >-->
  <!--      បន្ទាប់-->
  <!--    </v-btn>-->
  <!--  </div>-->
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
  const window = ref(0)

  // on click getstarted function => redirect to form page
  function getStarted () {
    router.push('/apps/form')
  }
</script>
