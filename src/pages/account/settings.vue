<script lang="ts" setup>
  import { ref } from 'vue'

  const settings = ref({
    language: 'km',
    theme: 'light',
    timezone: 'Asia/Bangkok',
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    marketingEmails: false,
    dataSharing: true,
    activityLog: true,
  })

  const languages = [
    { value: 'km', label: 'ខ្មែរ' },
    { value: 'en', label: 'English' },
  ]

  const themes = [
    { value: 'light', label: 'ពន្លឺ' },
    { value: 'dark', label: 'ងងឹត' },
    { value: 'auto', label: 'ស្វយ័ត' },
  ]

  const timezones = [
    { value: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
    { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (UTC+7)' },
    { value: 'UTC', label: 'UTC' },
  ]

  function saveSettings () {
    // Add save logic here
    console.log('Settings saved:', settings.value)
  }

  function resetSettings () {
    // Reset to default settings
    settings.value = {
      language: 'km',
      theme: 'light',
      timezone: 'Asia/Bangkok',
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      marketingEmails: false,
      dataSharing: true,
      activityLog: true,
    }
  }
</script>

<template>
  <v-container class="py-8">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 font-weight-600 mb-8">ការកំណត់</h1>
      </v-col>

      <!-- Language & Theme Settings -->
      <v-col cols="12" md="6">
        <v-card class="elevation-0 border">
          <v-card-title class="text-h6 font-weight-600 border-b pa-4">
            ការលទ្ធផលបង្ហាញ
          </v-card-title>
          <v-card-text class="pa-4">
            <div class="mb-6">
              <label class="text-body2 font-weight-600 mb-2 d-block">ភាសា</label>
              <v-select
                v-model="settings.language"
                item-title="label"
                item-value="value"
                :items="languages"
                size="small"
                variant="outlined"
              />
            </div>

            <div class="mb-6">
              <label class="text-body2 font-weight-600 mb-2 d-block">ស្បែក</label>
              <v-select
                v-model="settings.theme"
                item-title="label"
                item-value="value"
                :items="themes"
                size="small"
                variant="outlined"
              />
            </div>

            <div>
              <label class="text-body2 font-weight-600 mb-2 d-block">ម៉ោងម៉ាឌីយ៉ូ</label>
              <v-select
                v-model="settings.timezone"
                item-title="label"
                item-value="value"
                :items="timezones"
                size="small"
                variant="outlined"
              />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Notification Settings -->
      <v-col cols="12" md="6">
        <v-card class="elevation-0 border">
          <v-card-title class="text-h6 font-weight-600 border-b pa-4">
            ការជូនដំណឹង
          </v-card-title>
          <v-card-text class="pa-4">
            <div class="mb-4 d-flex justify-space-between align-center">
              <div>
                <p class="text-body2 font-weight-600">ការជូនដំណឹងតាមរយៈអ៊ីមែល</p>
                <p class="text-caption text-medium-emphasis">ទទួលលទ្ធផលដ៏សំខាន់តាមរយៈអ៊ីមែល</p>
              </div>
              <v-switch v-model="settings.emailNotifications" />
            </div>

            <v-divider class="my-4" />

            <div class="mb-4 d-flex justify-space-between align-center">
              <div>
                <p class="text-body2 font-weight-600">ការជូនដំណឹង SMS</p>
                <p class="text-caption text-medium-emphasis">ទទួលលទ្ធផលដ៏សំខាន់តាមរយៈ SMS</p>
              </div>
              <v-switch v-model="settings.smsNotifications" />
            </div>

            <v-divider class="my-4" />

            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-body2 font-weight-600">ការជូនដំណឹងរបស់កម្មវីធី</p>
                <p class="text-caption text-medium-emphasis">ទទួលលទ្ធផលក្នុងកម្មវីធី</p>
              </div>
              <v-switch v-model="settings.pushNotifications" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Privacy Settings -->
      <v-col cols="12">
        <v-card class="elevation-0 border">
          <v-card-title class="text-h6 font-weight-600 border-b pa-4">
            ឯកជនភាព
          </v-card-title>
          <v-card-text class="pa-4">
            <div class="mb-4 d-flex justify-space-between align-center">
              <div>
                <p class="text-body2 font-weight-600">ការលែងបាច់លើសម្ភារៈផ្សាយពាណិជ្ជកម្ម</p>
                <p class="text-caption text-medium-emphasis">
                  ទទួលលទ្ធផលដ៏ពេញលេញពីលើសម្ភារៈផ្សាយពាណិជ្ជកម្ម និងការផ្សាយពាណិជ្ជកម្ម
                </p>
              </div>
              <v-switch v-model="settings.marketingEmails" />
            </div>

            <v-divider class="my-4" />

            <div class="mb-4 d-flex justify-space-between align-center">
              <div>
                <p class="text-body2 font-weight-600">ការលែងបាច់ទិន្នន័យ</p>
                <p class="text-caption text-medium-emphasis">
                  អនុញ្ញាតឱ្យយើងចែករំលែកទិន្នន័យរបស់អ្នកដើម្បីបង្កើនលទ្ធផល
                </p>
              </div>
              <v-switch v-model="settings.dataSharing" />
            </div>

            <v-divider class="my-4" />

            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-body2 font-weight-600">កំណត់ហេតុសកម្មភាព</p>
                <p class="text-caption text-medium-emphasis">
                  ផ្សាយពាណិជ្ជកម្មលម្អិតលម្អិតលម្អិតលម្អិត
                </p>
              </div>
              <v-switch v-model="settings.activityLog" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Storage & Data -->
      <v-col cols="12">
        <v-card class="elevation-0 border">
          <v-card-title class="text-h6 font-weight-600 border-b pa-4">
            ទិន្នន័យ & ការផ្ទុក
          </v-card-title>
          <v-card-text class="pa-4">
            <div class="mb-6">
              <p class="text-body2 font-weight-600 mb-2">ការប្រើប្រាស់ទិន្នន័យ</p>
              <div class="d-flex align-center gap-2">
                <v-progress-linear
                  class="flex-grow-1"
                  color="success"
                  height="8"
                  model-value="65"
                />
                <span class="text-caption">6.5 GB / 10 GB</span>
              </div>
            </div>

            <v-divider class="my-4" />

            <div class="d-flex gap-2">
              <v-btn
                color="error"
                variant="tonal"
              >
                សម្អាតប័ណ្ណសម្ងាក់
              </v-btn>
              <v-btn
                color="warning"
                variant="outlined"
              >
                ទាញយកទិន្នន័យរបស់ខ្ញុំ
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Action Buttons -->
      <v-col
        class="d-flex gap-2 justify-end mt-4"
        cols="12"
      >
        <v-btn
          variant="outlined"
          @click="resetSettings"
        >
          កំណត់ឡើងវិញ
        </v-btn>
        <v-btn
          color="success"
          variant="tonal"
          @click="saveSettings"
        >
          រក្សាទុកការកំណត់
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
  .border {
    border: 1px solid rgba(0, 0, 0, 0.12);
  }

  .border-b {
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }
</style>
