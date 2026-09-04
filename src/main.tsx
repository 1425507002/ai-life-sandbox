import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'

const DEV_PWA_RECOVERY_KEY = 'ai-life-worlds:dev-pwa-recovered'

const startApp = async () => {
  const isLocalPreview = import.meta.env.PROD && ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '4174'
  if ((import.meta.env.DEV || isLocalPreview) && 'serviceWorker' in navigator) {
    try {
      // Never let a local preview's PWA worker serve stale assets. Preview mode
      // is production-built, so import.meta.env.DEV alone is not enough here.
      // This matters when the same localhost URL is opened in multiple browser
      // profiles (for example Edge and the embedded Codex browser).
      const appScope = `${window.location.origin}/`
      const registrations = await navigator.serviceWorker.getRegistrations()
      const appRegistrations = registrations.filter((registration) => registration.scope === appScope)
      const wasControlled = Boolean(navigator.serviceWorker.controller) || appRegistrations.length > 0
      await Promise.all(appRegistrations.map((registration) => registration.unregister()))

      // Remove only Workbox caches created by the PWA, not every cache in this
      // origin. This makes a later reload independent of the old precache.
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('workbox-precache-') || cacheName.startsWith('workbox-runtime-'))
            .map((cacheName) => caches.delete(cacheName)),
        )
      }

      // Unregistering does not release the current page immediately. Reload
      // once so the next document is fetched without the old worker's bundle.
      let canUseSessionStorage = false
      try {
        sessionStorage.setItem(`${DEV_PWA_RECOVERY_KEY}:probe`, '1')
        sessionStorage.removeItem(`${DEV_PWA_RECOVERY_KEY}:probe`)
        canUseSessionStorage = true
      } catch {
        // Storage can be disabled in privacy-restricted embedded browsers.
      }

      if (wasControlled && canUseSessionStorage && !sessionStorage.getItem(DEV_PWA_RECOVERY_KEY)) {
        sessionStorage.setItem(DEV_PWA_RECOVERY_KEY, '1')
        window.location.reload()
        return
      }
      if (canUseSessionStorage) {
        sessionStorage.removeItem(DEV_PWA_RECOVERY_KEY)
      }
    } catch {
      // PWA cleanup is best-effort. A browser policy error must never leave the
      // game on a blank page.
    }
  } else if (!import.meta.env.DEV) {
    registerSW({ immediate: true })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void startApp()
