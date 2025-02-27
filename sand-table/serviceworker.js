
const CACHE_NAME = 'cache-2022-12-14T17:10:02.422'
const OFFLINE_PAGE_URL = '/offline/'
const PRECACHE_RESOURCES = []
const IGNORED_HOSTS = ['localhost']

// On Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME)

            // add all resources we want to precache first
            if (PRECACHE_RESOURCES.length) {
                cache.addAll(PRECACHE_RESOURCES)
            }

            // then add the offline page.
            // Setting {cache: 'reload'} in the new request will ensure that the
            // response isn't fulfilled from the HTTP cache; i.e., it will be from
            // the network.
            await cache.add(new Request(OFFLINE_PAGE_URL, { cache: 'reload' }))
        })()
    )
    // Force the waiting service worker to become the active service worker.
    self.skipWaiting()
})

// On Activation
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // Enable navigation preload if it's supported.
            // See https://developers.google.com/web/updates/2017/02/navigation-preload
            if ('navigationPreload' in self.registration) {
                await self.registration.navigationPreload.enable()
            }

            // clear out any old caches that might still be around
            const cacheNames = await caches.keys()
            await Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName)
                    }
                })
            )
        })()
    )

    // Tell the active service worker to take control of the page immediately.
    self.clients.claim()
})

// On Request
self.addEventListener('fetch', (event) => {
    const { hostname } = new URL(event.request.url)
    if (IGNORED_HOSTS.indexOf(hostname) >= 0) {
        return
    }

    // For navigation requests (GET to a new location)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // First, try to use the navigation preload response if it's supported.
                    const preloadResponse = await event.preloadResponse
                    if (preloadResponse) {
                        return preloadResponse
                    }
                    // Then try the network.
                    const networkResponse = await fetch(event.request)
                    return networkResponse
                } catch (error) {
                    // catch is only triggered if an exception is thrown, which is likely
                    // due to a network error.
                    // If fetch() returns a valid HTTP response with a response code in
                    // the 4xx or 5xx range, the catch() will NOT be called.
                    console.log(
                        'Fetch failed; returning offline page instead.',
                        error
                    )

                    const cache = await caches.open(CACHE_NAME)
                    const cachedResponse = await cache.match(OFFLINE_PAGE_URL)
                    return cachedResponse
                }
            })()
        )
    }
})
