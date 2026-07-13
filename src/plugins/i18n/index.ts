import type { I18nOptions } from 'vue-i18n'
import { createI18n } from 'vue-i18n'

type MessageSchema = Record<string, string>

interface LocaleMessages {
  [key: string]: MessageSchema
}

// Get saved language from localStorage or default to Khmer
const savedLocale = localStorage.getItem('locale') || 'kh'

function loadLocaleMessages (): LocaleMessages {
  return Object.fromEntries(
    Object.entries(import.meta.glob<{ default: MessageSchema }>('./locales/*.json', { eager: true })).map(
      ([key, value]) => [key.slice(10, -5), value.default],
    ),
  )
}

const i18nConfig: I18nOptions = {
  legacy: false,
  locale: savedLocale,
  globalInjection: true,
  fallbackLocale: 'en',
  messages: loadLocaleMessages(),
}

export default createI18n(i18nConfig)
