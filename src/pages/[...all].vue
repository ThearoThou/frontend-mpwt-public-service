<script lang="ts" setup>
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'

  const router = useRouter()
  const locale = ref<'en' | 'km'>((localStorage.getItem('locale') as 'en' | 'km') || 'km')

  const content = {
    km: {
      title: 'មិនរកឃើញទំព័រ',
      subtitle: '404',
      description: 'សុំទោស! ទំព័រដែលអ្នកកំពុងស្វែងរកមិនមានទេ។',
      suggestions: 'វាអាចត្រូវបានលុប ឬផ្លាស់ទី ឬអ្នកអាចបានវាយអាសយដ្ឋានមិនត្រឹមត្រូវ។',
      homeButton: 'ត្រឡប់ទៅទំព័រដើម',
      searchPlaceholder: 'ស្វែងរក...',
    },
    en: {
      title: 'Page Not Found',
      subtitle: '404',
      description: 'Sorry! The page you are looking for does not exist.',
      suggestions: 'It may have been deleted or moved, or you may have typed the address incorrectly.',
      homeButton: 'Go Back Home',
      searchPlaceholder: 'Search...',
    },
  }

  function goHome () {
    router.push('/')
  }

  function goBack () {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }
</script>

<template>
  <section>
    <v-container class="fill-height d-flex align-center justify-center">
      <v-row justify="center">
        <v-col cols="12" lg="6" md="8">
          <div class="text-center">
            <!-- 404 Large Number -->
            <div class="error-number mb-4">
              <h1 class="display-404">
                {{ content[locale].subtitle }}
              </h1>
            </div>

            <!-- Animated Icon -->
            <div class="mb-6">
              <v-icon color="primary" size="120">
                mdi-file-search-outline
              </v-icon>
            </div>

            <!-- Title -->
            <h2 class="text-h3 font-weight-bold mb-4">
              {{ content[locale].title }}
            </h2>

            <!-- Description -->
            <p class="text-h6 text-medium-emphasis mb-2">
              {{ content[locale].description }}
            </p>
            <p class="text-body-1 text-medium-emphasis mb-8">
              {{ content[locale].suggestions }}
            </p>

            <!-- Action Buttons -->
            <div class="d-flex flex-column flex-sm-row justify-center gap-4 mb-8">
              <v-btn
                color="primary"
                prepend-icon="mdi-home"
                size="large"
                variant="flat"
                @click="goHome"
              >
                {{ content[locale].homeButton }}
              </v-btn>

              <v-btn
                color="secondary"
                prepend-icon="mdi-arrow-left"
                size="large"
                variant="outlined"
                @click="goBack"
              >
                {{ locale === 'km' ? 'ត្រឡប់ក្រោយ' : 'Go Back' }}
              </v-btn>
            </div>

            <!-- Quick Links -->
            <v-card class="mx-auto" max-width="500" variant="tonal">
              <v-card-text>
                <p class="text-subtitle-2 mb-3">
                  {{ locale === 'km' ? 'តំណរហ័សៈ' : 'Quick Links:' }}
                </p>
                <v-chip-group>
                  <v-chip
                    v-for="link in [
                    { title: locale === 'km' ? 'ទំព័រដើម' : 'Home', to: '/' },
                    { title: locale === 'km' ? 'កម្មវិធី' : 'App', to: '/app' },
                    { title: locale === 'km' ? 'សេវា' : 'Service', to: '/service' },
                    { title: locale === 'km' ? 'ដំណឹង' : 'News', to: '/news' },
                    { title: locale === 'km' ? 'អំពីកម្មវីធី' : 'About', to: '/about' },
                  ]"
                    :key="link.to"
                    class="ma-1"
                    color="primary"
                    :to="link.to"
                    variant="outlined"
                  >
                    {{ link.title }}
                  </v-chip>
                </v-chip-group>
              </v-card-text>
            </v-card>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<style scoped>
.display-404 {
  font-size: clamp(6rem, 20vw, 12rem);
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.gap-4 {
  gap: 1rem;
}

.v-icon {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

/* Smooth transitions */
.v-btn, .v-chip {
  transition: all 0.3s ease;
}

.v-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.v-chip:hover {
  transform: scale(1.05);
}
</style>
