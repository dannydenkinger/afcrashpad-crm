// AFCrashpad CRM Service Worker - Offline Support
const CACHE_VERSION = "v2";
const STATIC_CACHE = `afcrashpad-static-${CACHE_VERSION}`;
const DATA_CACHE = `afcrashpad-data-${CACHE_VERSION}`;
const OFFLINE_QUEUE_STORE = "offline-mutations";

// App shell files to pre-cache
const APP_SHELL = [
  "/",
  "/pipeline",
  "/contacts",
  "/dashboard",
  "/manifest.json",
];

// ── Install: Pre-cache app shell ────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: Clean old caches ──────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== STATIC_CACHE && key !== DATA_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-first for static, network-first for data ───────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations are queued below)
  if (request.method !== "GET") return;

  // Skip chrome-extension, webpack HMR, etc.
  if (!url.protocol.startsWith("http")) return;

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation / data requests: network-first with cache fallback
  event.respondWith(networkFirst(request, DATA_CACHE));
});

function isStaticAsset(url) {
  const pathname = url.pathname;
  // Note: /_next/static/, .js, .css are intentionally excluded — Next.js
  // fingerprints these with content hashes and sets immutable cache headers.
  // Caching them here with cache-first breaks Turbopack HMR in development.
  return (
    pathname.startsWith("/icons/") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  );
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, return cached app shell
    if (request.mode === "navigate") {
      const shellCached = await caches.match("/");
      if (shellCached) return shellCached;
    }

    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

// ── Offline mutation queue (IndexedDB) ──────────────────────────────────────

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("afcrashpad-offline", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueMutation(mutation) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    tx.objectStore(OFFLINE_QUEUE_STORE).add({
      ...mutation,
      timestamp: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueuedMutations() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function clearQueuedMutations() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    tx.objectStore(OFFLINE_QUEUE_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Background Sync: replay queued mutations when back online ───────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-mutations") {
    event.waitUntil(replayMutations());
  }
});

async function replayMutations() {
  const mutations = await getQueuedMutations();
  if (!mutations || mutations.length === 0) return;

  for (const mutation of mutations) {
    try {
      await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body,
      });
    } catch {
      // If replay fails, leave in queue for next sync
      return;
    }
  }

  await clearQueuedMutations();

  // Notify all clients to refresh
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "sync-complete", count: mutations.length });
  });
}

// ── Message handler: accept mutation queue requests from main thread ─────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "QUEUE_MUTATION") {
    queueMutation(event.data.mutation);
  }
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
