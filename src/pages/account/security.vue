<script lang="ts" setup>
  import { ref } from 'vue'

  const securityData = ref({
    lastLogin: '2024-12-18 at 14:32',
    lastLoginLocation: 'Phnom Penh, Cambodia',
    passwordLastChanged: '2024-06-15',
  })

  const showPasswordForm = ref(false)
  const passwordForm = ref({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const showPasswordCurrent = ref(false)
  const showPasswordNew = ref(false)
  const showPasswordConfirm = ref(false)

  const twoFactorEnabled = ref(true)
  const deviceSessions = ref([
    {
      id: 1,
      device: 'Windows PC',
      browser: 'Chrome 131.0',
      location: 'Phnom Penh, Cambodia',
      lastActive: '2024-12-18 14:32',
      isCurrent: true,
    },
    {
      id: 2,
      device: 'iPhone 15',
      browser: 'Safari',
      location: 'Phnom Penh, Cambodia',
      lastActive: '2024-12-17 09:15',
      isCurrent: false,
    },
  ])

  const loginHistory = ref([
    {
      id: 1,
      device: 'Windows PC',
      location: 'Phnom Penh, Cambodia',
      timestamp: '2024-12-18 14:32',
      success: true,
    },
    {
      id: 2,
      device: 'Mobile Phone',
      location: 'Unknown',
      timestamp: '2024-12-17 22:15',
      success: false,
    },
    {
      id: 3,
      device: 'iPhone 15',
      location: 'Phnom Penh, Cambodia',
      timestamp: '2024-12-17 09:15',
      success: true,
    },
  ])

  function updatePassword () {
    // Add password update logic here
    showPasswordForm.value = false
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
  }

  function revokeSession (id: number) {
    deviceSessions.value = deviceSessions.value.filter(s => s.id !== id)
  }

  function revokeAllOtherSessions () {
    deviceSessions.value = deviceSessions.value.filter(s => s.isCurrent)
  }
</script>

<template>
  <v-container class="py-8">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 font-weight-600 mb-8">សុវត្ថិភាព</h1>
      </v-col>

      <!-- Password Section -->
      <v-col cols="12">
        <v-card class="elevation-0 border">
          <v-card-title class="text-h6 font-weight-600 border-b pa-4">
            ពាក្យសម្ងាត់
          </v-card-title>
          <v-card-text class="pa-4">
            <p class="text-body2 text-medium-emphasis mb-4">
              ផ្លាស់ប្តូរពាក្យសម្ងាត់របស់អ្នក ដើម្បីបង្កើតគណនីរបស់អ្នកឱ្យសុវត្ថិ
            </p>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-body2 font-weight-600 mb-1">ផ្លាស់ប្តូរលាលឿង</p>
                <p class="text-caption text-medium-emphasis">
                  {{ securityData.passwordLastChanged }}
                </p>
              </div>
              <v-btn
                v-if="!showPasswordForm"
                variant="tonal"
                @click="showPasswordForm = true"
              >
                ផ្លាស់ប្តូរពាក្យសម្ងាត់
              </v-btn>
            </div>

            <!-- Password Form -->
            <v-slide-y-transition>
              <div v-if="showPasswordForm" class="mt-4 pt-4 border-t">
                <v-row>
                  <v-col cols="12">
                    <v-text-field
                      v-model="passwordForm.currentPassword"
                      :append-inner-icon="showPasswordCurrent ? 'mdi-eye-off' : 'mdi-eye'"
                      label="ពាក្យសម្ងាត់បច្ចុប្បន្ន"
                      size="small"
                      :type="showPasswordCurrent ? 'text' : 'password'"
                      variant="outlined"
                      @click:append-inner="showPasswordCurrent = !showPasswordCurrent"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="passwordForm.newPassword"
                      :append-inner-icon="showPasswordNew ? 'mdi-eye-off' : 'mdi-eye'"
                      label="ពាក្យសម្ងាត់ថ្មី"
                      size="small"
                      :type="showPasswordNew ? 'text' : 'password'"
                      variant="outlined"
                      @click:append-inner="showPasswordNew = !showPasswordNew"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="passwordForm.confirmPassword"
                      :append-inner-icon="showPasswordConfirm ? 'mdi-eye-off' : 'mdi-eye'"
                      label="បញ្ជាក់ពាក្យសម្ងាត់ថ្មី"
                      size="small"
                      :type="showPasswordConfirm ? 'text' : 'password'"
                      variant="outlined"
                      @click:append-inner="showPasswordConfirm = !showPasswordConfirm"
                    />
                  </v-col>
                  <v-col class="d-flex gap-2" cols="12">
                    <v-btn
                      variant="tonal"
                      @click="updatePassword"
                    >
                      រក្សាទុក
                    </v-btn>
                    <v-btn
                      variant="outlined"
                      @click="showPasswordForm = false"
                    >
                      បោះបង់
                    </v-btn>
                  </v-col>
                </v-row>
              </div>
            </v-slide-y-transition>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Two Factor Authentication -->
      <v-col cols="12">
        <v-card class="elevation-0 border">
          <v-card-title class="text-h6 font-weight-600 border-b pa-4">
            ការផ្ទៀងផ្ទាត់ពីរកត្តា
          </v-card-title>
          <v-card-text class="pa-4">
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-body2 font-weight-600 mb-1">
                  ការផ្ទៀងផ្ទាត់ពីរកត្តា (2FA)
                </p>
                <p class="text-caption text-medium-emphasis">
                  បង្កើនសុវត្ថិភាពនៃគណនីរបស់អ្នក
                </p>
              </div>
              <v-switch
                v-model="twoFactorEnabled"
                color="success"
              />
            </div>
            <v-alert
              v-if="twoFactorEnabled"
              class="mt-4"
              closable
              type="success"
              variant="tonal"
            >
              ការផ្ទៀងផ្ទាត់ពីរកត្តា ដំណើរការលម្អិតនៅលើឧបករណ៍របស់អ្នក
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Active Sessions -->
      <v-col cols="12">
        <v-card class="elevation-0 border">
          <v-card-title class="text-h6 font-weight-600 border-b pa-4 d-flex justify-space-between">
            <span>សម័យកាលសកម្ម</span>
            <v-btn
              color="error"
              size="small"
              variant="outlined"
              @click="revokeAllOtherSessions"
            >
              ផ្ដាច់សម័យកាលផ្សេងទៀត
            </v-btn>
          </v-card-title>
          <v-list>
            <v-list-item
              v-for="(session) in deviceSessions"
              :key="session.id"
              class="py-3"
            >
              <template #prepend>
                <v-avatar class="mr-3" color="primary" size="40">
                  <v-icon>
                    {{ session.device.includes('iPhone') || session.device.includes('Mobile') ? 'mdi-cellphone' : 'mdi-desktop-classic' }}
                  </v-icon>
                </v-avatar>
              </template>

              <v-list-item-title class="font-weight-600">
                {{ session.device }}
                <v-chip
                  v-if="session.isCurrent"
                  class="ml-2"
                  color="success"
                  size="x-small"
                  text-color="white"
                >
                  បច្ចុប្បន្ន
                </v-chip>
              </v-list-item-title>

              <v-list-item-subtitle>
                <div class="text-caption">{{ session.browser }}</div>
                <div class="text-caption">{{ session.location }}</div>
                <div class="text-caption">{{ session.lastActive }}</div>
              </v-list-item-subtitle>

              <template #append>
                <v-btn
                  v-if="!session.isCurrent"
                  color="error"
                  size="small"
                  variant="outlined"
                  @click="revokeSession(session.id)"
                >
                  ផ្ដាច់
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- Login History -->
      <v-col cols="12">
        <v-card class="elevation-0 border">
          <v-card-title class="text-h6 font-weight-600 border-b pa-4">
            ប្រវត្តិការចូល
          </v-card-title>
          <v-table>
            <tbody>
              <tr v-for="login in loginHistory" :key="login.id">
                <td class="pa-4">
                  <v-icon class="mr-2" :color="login.success ? 'success' : 'error'" size="small">
                    {{ login.success ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                  </v-icon>
                  <span class="text-body2">{{ login.device }}</span>
                </td>
                <td class="pa-4 text-body2">{{ login.location }}</td>
                <td class="pa-4 text-body2 text-medium-emphasis">{{ login.timestamp }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
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

  .border-t {
    border-top: 1px solid rgba(0, 0, 0, 0.12);
  }
</style>
