/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { createApp } from 'vue'
// import { useKeycloak } from '@/composables/useKeycloak'

// Plugins
import { registerPlugins } from '@/plugins'

import { useAuthStore } from '@/stores/auth.ts'
// Components
import App from './App.vue'
// Styles
import 'unfonts.css'

const app = createApp(App)
// const { init, getUserInfo } = useKeycloak()

// init().then(authenticated => {
//   if (authenticated) {
//     console.log('Authenticated', authenticated)
//     const userInfo = getUserInfo()
//     console.log('User Info:', userInfo)
//   } else {
//     console.error('Not authenticated')
//   }
// })

registerPlugins(app)

const authStore = useAuthStore()
authStore.initializeAuth().then(() => {
  app.mount('#app')
})

// app.mount('#app')
