<script lang="ts" setup>
  import type { KeycloakUserInfo } from '@/composables/useKeycloak'
  import { ref, watch } from 'vue'
  import { Cropper } from 'vue-advanced-cropper'
  import { useAuthStore } from '@/stores/auth.ts'
  import 'vue-advanced-cropper/dist/style.css'

  const authStore = useAuthStore()
  const isEditing = ref(false)
  const userData = ref<KeycloakUserInfo | null>(authStore.user)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const cropDialog = ref(false)
  const cropImage = ref<string | null>(null)
  const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

  watch(
    () => authStore.user,
    value => {
      userData.value = value
    },
    { immediate: true },
  )

  function toggleEdit () {
    isEditing.value = !isEditing.value
  }

  function saveProfile () {
    // Add save logic here
    isEditing.value = false
  }

  function handleAvatarClick () {
    if (!isEditing.value) return
    fileInputRef.value?.click()
  }

  function handleFileChange (event: Event) {
    const target = event.target as HTMLInputElement | null
    const file = target?.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      cropImage.value = reader.result as string
      cropDialog.value = true
    })
    reader.readAsDataURL(file)

    if (target) {
      target.value = ''
    }
  }

  function closeCropDialog () {
    cropDialog.value = false
    cropImage.value = null
    cropperRef.value = null
  }

  function handleCropConfirm () {
    const result = cropperRef.value?.getResult()
    const canvas = result?.canvas

    if (!canvas || !userData.value) {
      closeCropDialog()
      return
    }

    const base64 = canvas.toDataURL('image/png')
    console.log('Cropped avatar base64:', base64)

    const updatedUser: KeycloakUserInfo = { ...userData.value, avatar: base64 }
    userData.value = updatedUser
    authStore.user = updatedUser

    closeCropDialog()
  }
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="elevation-0 rounded" variant="text">
          <div class="pa-6 text-center">
            <div class="avatar-wrapper mb-4">
              <v-avatar
                :image="userData?.avatar"
                size="120"
              />
              <div
                v-if="isEditing"
                class="avatar-overlay"
                @click="handleAvatarClick"
              >
                <v-icon color="white" icon="mdi-camera" size="28" />
              </div>
              <input
                ref="fileInputRef"
                accept="image/*"
                class="sr-only"
                type="file"
                @change="handleFileChange"
              >
            </div>
            <h2 class="text-h6 font-weight-600">
              {{ userData?.family_name }} {{ userData?.given_name }}
            </h2>
            <p class="text-body2 text-medium-emphasis">
              {{ userData?.email }}
            </p>
          </div>
          <div class="d-flex flex-column align-center">
            <v-btn
              v-if="!isEditing"
              class="mb-2"
              variant="text"
              @click="toggleEdit"
            >
              កែសម្រួលប្រវត្តិរូប
            </v-btn>
            <div v-else class="d-flex ga-2">
              <v-btn
                variant="tonal"
                @click="saveProfile"
              >
                រក្សាទុក
              </v-btn>
              <v-btn
                variant="outlined"
                @click="toggleEdit"
              >
                បោះបង់
              </v-btn>
            </div>
          </div>
        </v-card>
        <!-- Profile Form -->
        <v-card class="elevation-0 rounded mt-4" variant="text">
          <v-card-title class="text-h6 font-weight-600 rounded-b">
            ព័ត៌មានលម្អិត
          </v-card-title>
          <v-card-text>
            <v-list class="rounded">
              <v-list-item>
                <v-list-item-title class="text-medium-emphasis">
                  នាមខ្លួន
                </v-list-item-title>
                <v-list-item-subtitle class="text-body-1 mt-2 font-weight-600">
                  {{ userData?.given_name }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-divider inset />
              <v-list-item>
                <v-list-item-title class="text-medium-emphasis">
                  នាមត្រកូល
                </v-list-item-title>
                <v-list-item-subtitle class="text-body-1 mt-2 font-weight-600">
                  {{ userData?.family_name }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <v-card class="elevation-0 rounded mt-4" variant="text">
          <v-card-title class="text-h6 font-weight-600 rounded-b">
            គណនីលម្អិត
          </v-card-title>
          <v-card-text>
            <v-list class="rounded">
              <v-list-item>
                <v-list-item-title class="text-medium-emphasis">
                  ប្រភេទគណនី
                </v-list-item-title>
                <v-list-item-subtitle class="text-body-1 mt-2 font-weight-600">
                  {{ userData?.given_name }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-medium-emphasis">
                  ស្ថានភាពលេខសម្គាល់
                </v-list-item-title>
                <v-list-item-subtitle class="text-body-1 mt-2 font-weight-600">
                  <v-chip color="success" size="small" variant="elevated">
                    បានផ្ទៀងផ្ទាត់ដោយអ៊ីមែល
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <v-card class="elevation-0 rounded mt-4" variant="text">
          <v-card-title class="text-h6 font-weight-600 rounded-b">
            គណនីលម្អិត
          </v-card-title>
          <v-card-text>
            <v-list class="rounded">
              <v-list-item>
                <v-list-item-title class="text-medium-emphasis">
                  ប្រភេទគណនី
                </v-list-item-title>
                <v-list-item-subtitle class="text-body-1 mt-2 font-weight-600">
                  {{ userData?.given_name }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-medium-emphasis">
                  ស្ថានភាពលេខសម្គាល់
                </v-list-item-title>
                <v-list-item-subtitle class="text-body-1 mt-2 font-weight-600">
                  <v-chip color="success" size="small" variant="elevated">
                    បានផ្ទៀងផ្ទាត់ដោយអ៊ីមែល
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
        <v-dialog v-model="cropDialog" max-width="480">
          <v-card>
            <v-card-title class="text-h6 font-weight-600">
              កែរូបភាព
            </v-card-title>
            <v-card-text>
              <Cropper
                v-if="cropImage"
                ref="cropperRef"
                class="avatar-cropper"
                :src="cropImage"
                :stencil-props="{ aspectRatio: 1 }"
                :transition-duration="250"
              />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="closeCropDialog">
                បោះបង់
              </v-btn>
              <v-btn color="primary" @click="handleCropConfirm">
                រក្សាទុក
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.avatar-wrapper {
  position: relative;
  width: 120px;
  margin: 0 auto;
}

.avatar-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 55%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom-left-radius: 999px;
  border-bottom-right-radius: 999px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.75) 100%);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.avatar-overlay:hover {
  opacity: 0.85;
}

.avatar-cropper {
  width: 100%;
  height: 320px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
