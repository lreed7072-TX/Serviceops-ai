/// Service Worker for ServiceOpsIQ PWA
const CACHE_VERSION = "v2";
const STATIC_CACHE = `serviceopsiq-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `serviceopsiq-dynamic-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

// Static assets to precache
const PRECACHE_URLS = [
  "/offline",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Background sync queue for failed mutations
const SYNC_QUEUE = "serviceopsiq-sync-queue";

// Install: precache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: apply caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (queue mutations for background sync)
  if (request.method !== "GET") {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      event.respondWith(handleMutation(request));
    }
    return;
  }

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Skip cross-origin requests (CDN videos, external resources)
  // Service workers can break video streaming with range requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API calls: network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (images, fonts, icons): cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Next.js data requests: network-first
  if (url.pathname.startsWith("/_next/data/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Page navigations: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request));
});

// Strategy: Cache-first (for static assets)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 408, statusText: "Offline" });
  }
}

// Strategy: Network-first (for API and dynamic content)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Strategy: Network-first with offline fallback page
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Serve offline page
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) {
      return offlinePage;
    }
    return new Response(
      "<html><body><h1>Offline</h1><p>Please check your connection.</p></body></html>",
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

// Handle mutations (POST, PATCH, PUT, DELETE) with background sync fallback
async function handleMutation(request) {
  try {
    return await fetch(request);
  } catch {
    // Queue for background sync if supported
    if ("indexedDB" in self) {
      await queueRequest(request);
    }
    return new Response(
      JSON.stringify({
        error: "Offline",
        queued: true,
        message: "Your changes have been saved and will sync when you are back online.",
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// IndexedDB helpers for background sync queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("serviceopsiq-sw", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("sync-queue", {
        keyPath: "id",
        autoIncrement: true,
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueRequest(request) {
  try {
    const body = await request.clone().text();
    const db = await openDB();
    const tx = db.transaction("sync-queue", "readwrite");
    tx.objectStore("sync-queue").add({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  } catch (err) {
    console.error("[SW] Failed to queue request:", err);
  }
}

async function replayQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction("sync-queue", "readonly");
    const store = tx.objectStore("sync-queue");
    const allReq = store.getAll();
    const items = await new Promise((resolve, reject) => {
      allReq.onsuccess = () => resolve(allReq.result);
      allReq.onerror = () => reject(allReq.error);
    });

    for (const item of items) {
      try {
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body || undefined,
        });
        // Remove from queue on success
        const delTx = db.transaction("sync-queue", "readwrite");
        delTx.objectStore("sync-queue").delete(item.id);
        await new Promise((resolve) => {
          delTx.oncomplete = resolve;
        });
      } catch {
        // Still offline, stop replaying
        break;
      }
    }
    db.close();
  } catch (err) {
    console.error("[SW] Failed to replay queue:", err);
  }
}

// Listen for sync events (Background Sync API)
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_QUEUE) {
    event.waitUntil(replayQueue());
  }
});

// Also replay when coming back online via message
self.addEventListener("message", (event) => {
  if (event.data === "REPLAY_QUEUE") {
    replayQueue();
  }
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
