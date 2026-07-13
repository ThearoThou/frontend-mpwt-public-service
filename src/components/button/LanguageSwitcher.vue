<template>
  <v-menu>
    <template #activator="{ props }">
      <v-btn
        icon
        variant="text"
        v-bind="props"
      >
        <v-icon>{{ locale === 'kh' ? 'twemoji:flag-cambodia' : 'twemoji:flag-united-kingdom' }}</v-icon>
      </v-btn>
    </template>

    <v-list>
      <v-list-item
        v-for="lang in languages"
        :key="lang.code"
        :class="{ 'v-list-item--active': locale === lang.code }"
        @click="changeLanguage(lang.code)"
      >
        <v-list-item-title>
          <v-icon class="mr-2">{{ lang.flag }}</v-icon>
          {{ lang.name }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  const { locale, t } = useI18n()

  const languages = [
    { code: 'kh', name: 'ខ្មែរ', flag: 'twemoji:flag-cambodia' },
    { code: 'en', name: 'English', flag: 'twemoji:flag-united-kingdom' },
  ]

  function changeLanguage (lang: string) {
    locale.value = lang
    localStorage.setItem('locale', lang)

  // Optional: Reload page to ensure all components update
  // window.location.reload();
  }
</script>
