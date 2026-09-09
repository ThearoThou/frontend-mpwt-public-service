<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import cambodiaFlagUrl from '@/assets/cambodia-flag.svg'
  import { setAppLocale, type SupportedLocale } from '@/plugins/i18n'

  withDefaults(defineProps<{
    display?: 'flags' | 'icon' | 'text'
    variant?: 'light' | 'dark'
  }>(), {
    display: 'text',
    variant: 'light',
  })

  const { locale, t } = useI18n()
  const activeLocale = computed<SupportedLocale>(() => locale.value === 'en' ? 'en' : 'kh')
  const languageToggleLabel = computed(() => activeLocale.value === 'kh' ? 'Switch to English' : 'Switch to Khmer')

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
    <template v-if="display === 'flags'">
      <button
        :aria-label="languageToggleLabel"
        class="language-switcher__flag-toggle"
        type="button"
        @click="toggleLanguage"
      >
        <img
          v-if="activeLocale === 'kh'"
          alt=""
          class="language-switcher__flag"
          :src="cambodiaFlagUrl"
        >

        <svg
          v-else
          aria-hidden="true"
          class="language-switcher__flag"
          focusable="false"
          viewBox="0 0 52 30"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect fill="#012169" height="30" width="52" />
          <path d="M0 0l52 30M52 0 0 30" stroke="#fff" stroke-width="7" />
          <path d="M0 0l52 30M52 0 0 30" stroke="#c8102e" stroke-width="3" />
          <path d="M26 0v30M0 15h52" stroke="#fff" stroke-width="10" />
          <path d="M26 0v30M0 15h52" stroke="#c8102e" stroke-width="6" />
        </svg>
      </button>
    </template>

    <template v-else>
      <button :aria-label="languageToggleLabel" class="language-switcher__toggle" type="button" @click="toggleLanguage">
        <v-icon aria-hidden="true" class="language-switcher__icon" icon="mdi-web" size="24" />
      </button>

      <template v-if="display === 'text'">
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
      </template>
    </template>
  </div>
</template>

<style scoped>
  .language-switcher { align-items: center; color: #35394a; display: inline-flex; font-size: .84rem; font-weight: 500; gap: 6px; white-space: nowrap; }
  .language-switcher--dark { color: #fff; }
  .language-switcher__toggle { align-items: center; background: transparent; border: 0; border-radius: 50%; color: inherit; cursor: pointer; display: inline-flex; height: 40px; justify-content: center; padding: 0; transition: background-color .2s ease; width: 40px; }
  .language-switcher__toggle:hover { background: rgb(255 255 255 / 12%); }
  .language-switcher__toggle:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .language-switcher__icon { flex: 0 0 auto; }
  .language-switcher__flag-toggle { align-items: center; border: 0; border-radius: 5px; color: inherit; cursor: pointer; display: inline-flex; padding: 3px; }
  .language-switcher__flag-toggle:hover { background: rgb(32 58 135 / 10%); }
  .language-switcher__flag-toggle:focus-visible { border-radius: 8px; outline: 2px solid currentColor; outline-offset: 3px; }
  .language-switcher__flag { border-radius: 3px; box-shadow: 0 0 0 1px rgb(16 23 45 / 20%), 0 1px 3px rgb(16 23 45 / 20%); display: block; height: 22px; width: 35px; }
  .language-switcher__option { border-bottom: 2px solid transparent; border-radius: 2px; color: inherit; cursor: pointer; font: inherit; line-height: 1.5; padding: 1px 0; }
  .language-switcher__option[aria-current='true'] { border-bottom-color: currentColor; color: #203a87; font-weight: 800; }
  .language-switcher--dark .language-switcher__option[aria-current='true'] { color: #fff; }
  .language-switcher__option:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .language-switcher__separator { opacity: .55; }
  .language-switcher__english-short { display: none; }
  @media (max-width: 360px) { .language-switcher { font-size: .78rem; gap: 4px; } .language-switcher__english-full { display: none; } .language-switcher__english-short { display: inline; } }
</style>
