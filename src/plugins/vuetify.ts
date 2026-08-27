/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

import { Icon } from '@iconify/vue'
// Composables
import { h } from 'vue'
import { useI18n } from 'vue-i18n'
import { createVuetify } from 'vuetify'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import i18n, { registerVuetifyLocaleSynchronizer } from './i18n'

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
const vuetify = createVuetify({
  locale: {
    adapter: createVueI18nAdapter({ i18n, useI18n }),
  },
  icons: {
    defaultSet: 'iconify',
    sets: {
      iconify: {
        component: (props: any) => h(Icon, props),
      },
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#f5f5f5', // Custom light background
          primary: '#192879',
          // primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107',
        },
      },
      dark: {
        dark: true,
        colors: {
          // background: '#121212', // Custom dark background
          primary: '#BB86FC',
          // primary: '#2196F3',
          secondary: '#424242',
          accent: '#FF4081',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FB8C00',
        },
      },
    },
  },
})

// Keep Vuetify's root locale in lockstep with the application's sole Vue I18n
// locale. VDatePicker's built-in adapter resolves this key through date.locale.
registerVuetifyLocaleSynchronizer(locale => {
  vuetify.locale.current.value = locale
})

export default vuetify
