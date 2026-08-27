import type { I18nOptions } from 'vue-i18n'
import { createI18n } from 'vue-i18n'
import { en as vuetifyEn, km as vuetifyKm } from 'vuetify/locale'

type MessageSchema = Record<string, string>
export const DEFAULT_LOCALE = 'kh'
export const LOCALE_STORAGE_KEY = 'locale'
export const SUPPORTED_LOCALES = ['kh', 'en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
type VuetifyLocaleSynchronizer = (locale: SupportedLocale) => void

interface LocaleMessages {
  [key: string]: MessageSchema
}

function isSupportedLocale (value: string | null): value is SupportedLocale {
  return value !== null && SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

function getInitialLocale (): SupportedLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }

  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return isSupportedLocale(savedLocale) ? savedLocale : DEFAULT_LOCALE
}

function loadLocaleMessages (): LocaleMessages {
  return Object.fromEntries(
    Object.entries(import.meta.glob<{ default: MessageSchema }>('./locales/*.json', { eager: true })).map(
      ([key, value]) => [key.slice(10, -5), value.default],
    ),
  )
}

const i18nConfig = {
  legacy: false,
  locale: getInitialLocale(),
  globalInjection: true,
  fallbackLocale: 'en',
  messages: loadLocaleMessages(),
} satisfies I18nOptions

const i18n = createI18n(i18nConfig)
let synchronizeVuetifyLocale: VuetifyLocaleSynchronizer | undefined

// Vuetify uses the same Vue I18n instance, including for the date picker.
// Adding its messages here keeps its controls in sync with the app language.
i18n.global.mergeLocaleMessage('en', { $vuetify: vuetifyEn })
i18n.global.mergeLocaleMessage('kh', { $vuetify: vuetifyKm })

export function registerVuetifyLocaleSynchronizer (
  synchronizer: VuetifyLocaleSynchronizer,
) {
  synchronizeVuetifyLocale = synchronizer
  synchronizer(i18n.global.locale.value as SupportedLocale)
}

export function setAppLocale (locale: SupportedLocale) {
  if (i18n.global.locale.value === locale) {
    return
  }

  i18n.global.locale.value = locale
  synchronizeVuetifyLocale?.(locale)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }
}

export default i18n
