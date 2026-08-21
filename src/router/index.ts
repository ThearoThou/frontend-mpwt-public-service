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
import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'
import { showInspectionLoginRequiredNotice } from '@/modules/inspection/auth/utils/access-notice'
import { inspectionRedirectOrDashboard } from '@/modules/inspection/auth/utils/auth.utils'
import pinia from '@/stores'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: setupLayouts(routes),
})

router.beforeEach(async (to: RouteLocationNormalized) => {
  const inspectionAuth = useInspectionAuthStore(pinia)

  if (to.meta.inspectionAuthPage) {
    await inspectionAuth.restoreSession()
    if (inspectionAuth.isCitizen) {
      return inspectionRedirectOrDashboard(to.query.redirect)
    }
    return true
  }

  if (!to.meta.requiresInspectionAuth) {
    return true
  }

  await inspectionAuth.restoreSession()

  if (inspectionAuth.isCitizen) {
    return true
  }

  showInspectionLoginRequiredNotice()
  return { path: '/services/inspection/dashboard' }
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
