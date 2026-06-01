// Minimal service worker: enables "Add to Home Screen" / installable PWA and
// offers a basic offline shell. Network-first so data stays fresh; falls back
// to cache when offline. Supabase API calls are never cached.
const CACHE = 'fff-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Don't touch Supabase API / auth / storage traffic.
  if (url.hostname.endsWith('.supabase.co')) return

  event.respondWith(
    fetch(request)
      .then((resp) => {
        const copy = resp.clone()
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
        return resp
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('./')))
  )
})
