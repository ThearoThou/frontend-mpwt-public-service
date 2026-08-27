<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { setAppLocale, type SupportedLocale } from '@/plugins/i18n'

  withDefaults(defineProps<{ variant?: 'light' | 'dark' }>(), { variant: 'light' })

  const { locale, t } = useI18n()
  const activeLocale = computed<SupportedLocale>(() => locale.value === 'en' ? 'en' : 'kh')

  function changeLanguage (language: SupportedLocale) {
    if (activeLocale.value === language) return
    setAppLocale(language)
  }

  function toggleLanguage () {
    changeLanguage(activeLocale.value === 'kh' ? 'en' : 'kh')
  }
</script>

<template>
  <div :aria-label="t('language')" class="language-switcher" :class="`language-switcher--${variant}`" role="group">

    <button :aria-label="t('language')" class="language-switcher__toggle" type="button" @click="toggleLanguage">
      <v-icon aria-hidden="true" class="language-switcher__icon" icon="mdi-web" size="24" />
    </button>

    <button
      :aria-current="activeLocale === 'kh' ? 'true' : undefined"
      :aria-pressed="activeLocale === 'kh'"
      class="language-switcher__option"
      type="button"
      @click="changeLanguage('kh')"
    >
      ខ្មែរ
    </button>

    <span aria-hidden="true" class="language-switcher__separator">|</span>

    <button
      :aria-current="activeLocale === 'en' ? 'true' : undefined"
      :aria-pressed="activeLocale === 'en'"
      class="language-switcher__option"
      type="button"
      @click="changeLanguage('en')"
    >
      <span class="language-switcher__english-full">English</span>
      <span class="language-switcher__english-short">EN</span>
    </button>
  </div>
</template>

<style scoped>
  .language-switcher { align-items: center; color: #35394a; display: inline-flex; font-size: .84rem; font-weight: 500; gap: 6px; white-space: nowrap; }
  .language-switcher--dark { color: #fff; }
  .language-switcher__toggle { align-items: center; border-radius: 50%; color: inherit; cursor: pointer; display: inline-flex; justify-content: center; padding: 2px; }
  .language-switcher__toggle:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .language-switcher__icon { flex: 0 0 auto; }
  .language-switcher__option { border-bottom: 2px solid transparent; border-radius: 2px; color: inherit; cursor: pointer; font: inherit; line-height: 1.5; padding: 1px 0; }
  .language-switcher__option[aria-current='true'] { border-bottom-color: currentColor; color: #203a87; font-weight: 800; }
  .language-switcher--dark .language-switcher__option[aria-current='true'] { color: #fff; }
  .language-switcher__option:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .language-switcher__separator { opacity: .55; }
  .language-switcher__english-short { display: none; }
  @media (max-width: 360px) { .language-switcher { font-size: .78rem; gap: 4px; } .language-switcher__english-full { display: none; } .language-switcher__english-short { display: inline; } }
</style>
