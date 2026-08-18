/**
 * router/index.ts
 *
 * Automatic routes for `./src/pages/*.vue`
 */

import type { RouteLocationNormalized } from 'vue-router'
import { setupLayouts } from 'virtual:generated-layouts'
// Composables
// @ts-ignore
import { createRouter, createWebHistory } from 'vue-router/auto'
import { routes } from 'vue-router/auto-routes'
import pinia from '@/stores'
import { useInspectionAuthStore } from '@/stores/inspectionAuth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: setupLayouts(routes),
})

router.beforeEach(async (to: RouteLocationNormalized) => {
  if (!to.meta.requiresInspectionAuth) {
    return true
  }

  const inspectionAuth = useInspectionAuthStore(pinia)
  await inspectionAuth.restoreSession()

  if (inspectionAuth.isCitizen) {
    return true
  }

  return {
    path: '/services/inspection/login',
    query: { redirect: to.fullPath },
  }
})

// Workaround for https://github.com/vitejs/vite/issues/11804
// @ts-ignore
router.onError((err, to) => {
  if (err?.message?.includes?.('Failed to fetch dynamically imported module')) {
    if (localStorage.getItem('vuetify:dynamic-reload')) {
      console.error('Dynamic import error, reloading page did not fix it', err)
    } else {
      console.log('Reloading page to fix dynamic import error')
      localStorage.setItem('vuetify:dynamic-reload', 'true')
      location.assign(to.fullPath)
    }
  } else {
    console.error(err)
  }
})

router.isReady().then(() => {
  localStorage.removeItem('vuetify:dynamic-reload')
})

export default router
