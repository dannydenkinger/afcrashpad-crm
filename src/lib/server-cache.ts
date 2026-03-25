/**
 * Simple in-memory TTL cache for serverless functions.
 * Persists for the lifetime of a warm function instance (typically 5-10 min on Netlify).
 * This dramatically reduces Firestore reads for repeated requests.
 */

interface CacheEntry<T> {
    data: T
    expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

/**
 * Get or set a cached value. If the cache is fresh, returns the cached value.
 * Otherwise, calls the fetcher, caches the result, and returns it.
 *
 * @param key - Unique cache key
 * @param fetcher - Async function to produce the value
 * @param ttlMs - Time to live in milliseconds (default: 30s)
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = 30_000): Promise<T> {
    const now = Date.now()
    const existing = store.get(key) as CacheEntry<T> | undefined

    if (existing && existing.expiresAt > now) {
        return existing.data
    }

    const data = await fetcher()
    store.set(key, { data, expiresAt: now + ttlMs })
    return data
}

/**
 * Invalidate a specific cache key or all keys matching a prefix.
 */
export function invalidateCache(keyOrPrefix?: string) {
    if (!keyOrPrefix) {
        store.clear()
        return
    }
    for (const key of store.keys()) {
        if (key === keyOrPrefix || key.startsWith(keyOrPrefix + ":")) {
            store.delete(key)
        }
    }
}
