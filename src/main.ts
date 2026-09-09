/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { createApp } from 'vue'
// import { useKeycloak } from '@/composables/useKeycloak'

import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'
// Plugins
import { registerPlugins } from '@/plugins'
import { useAuthStore } from '@/stores/auth.ts'
// Components
import App from './App.vue'
// Styles
import './styles/fonts.css'
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
const inspectionAuthStore = useInspectionAuthStore()

Promise.all([
  authStore.initializeAuth(),
  // The dashboard is intentionally public, so its route guard does not run an
  // inspection-session restore. Restore at startup instead to keep a signed-in
  // citizen signed in when the browser reloads any inspection page.
  inspectionAuthStore.restoreSession(),
]).then(() => {
  app.mount('#app')
})

// app.mount('#app')
