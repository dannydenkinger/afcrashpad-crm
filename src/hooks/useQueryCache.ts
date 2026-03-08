"use client"

import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from "react"

// ── Cache Store ─────────────────────────────────────────────────────────────

interface CacheEntry<T = unknown> {
    data: T
    timestamp: number
    ttl: number
}

class CacheStore {
    private cache = new Map<string, CacheEntry>()

    get<T>(key: string): { data: T; isStale: boolean } | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        const isStale = Date.now() - entry.timestamp > entry.ttl
        return { data: entry.data as T, isStale }
    }

    set<T>(key: string, data: T, ttl: number): void {
        this.cache.set(key, { data, timestamp: Date.now(), ttl })
    }

    invalidate(keyOrPrefix: string): void {
        if (keyOrPrefix.endsWith("*")) {
            const prefix = keyOrPrefix.slice(0, -1)
            for (const key of this.cache.keys()) {
                if (key.startsWith(prefix)) {
                    this.cache.delete(key)
                }
            }
        } else {
            this.cache.delete(keyOrPrefix)
        }
    }

    clear(): void {
        this.cache.clear()
    }
}

// Singleton store shared across all hooks
const globalCacheStore = new CacheStore()

// ── Context (optional, for invalidation from anywhere) ──────────────────────

interface CacheContextValue {
    invalidate: (keyOrPrefix: string) => void
    clear: () => void
}

const CacheContext = createContext<CacheContextValue>({
    invalidate: (key) => globalCacheStore.invalidate(key),
    clear: () => globalCacheStore.clear(),
})

export function useCacheContext() {
    return useContext(CacheContext)
}

// ── Default TTLs ────────────────────────────────────────────────────────────

export const CACHE_TTLS = {
    contacts: 5 * 60 * 1000,      // 5 minutes
    pipeline: 1 * 60 * 1000,      // 1 minute
    dashboard: 2 * 60 * 1000,     // 2 minutes
    settings: 10 * 60 * 1000,     // 10 minutes
    default: 3 * 60 * 1000,       // 3 minutes
} as const

// ── Cache key builder ───────────────────────────────────────────────────────

export function buildCacheKey(actionName: string, params?: unknown): string {
    if (!params) return actionName
    try {
        return `${actionName}:${JSON.stringify(params)}`
    } catch {
        return actionName
    }
}

// ── Main Hook ───────────────────────────────────────────────────────────────

interface UseQueryCacheOptions<T> {
    /** Unique cache key (use buildCacheKey helper) */
    key: string
    /** The server action to call */
    fetcher: () => Promise<T>
    /** Time-to-live in ms (default: 3 min) */
    ttl?: number
    /** Whether to run the fetcher on mount (default: true) */
    enabled?: boolean
}

interface UseQueryCacheResult<T> {
    data: T | null
    isLoading: boolean
    isRefreshing: boolean
    error: string | null
    refetch: () => Promise<void>
    invalidate: () => void
}

export function useQueryCache<T>({
    key,
    fetcher,
    ttl = CACHE_TTLS.default,
    enabled = true,
}: UseQueryCacheOptions<T>): UseQueryCacheResult<T> {
    const [data, setData] = useState<T | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher

    const fetchData = useCallback(async (background = false) => {
        if (!background) setIsLoading(true)
        else setIsRefreshing(true)
        setError(null)

        try {
            const result = await fetcherRef.current()
            globalCacheStore.set(key, result, ttl)
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Fetch failed")
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }, [key, ttl])

    // On mount / key change: stale-while-revalidate
    useEffect(() => {
        if (!enabled) {
            setIsLoading(false)
            return
        }

        const cached = globalCacheStore.get<T>(key)
        if (cached) {
            setData(cached.data)
            setIsLoading(false)
            if (cached.isStale) {
                // Revalidate in background
                fetchData(true)
            }
        } else {
            fetchData(false)
        }
    }, [key, enabled, fetchData])

    const refetch = useCallback(() => fetchData(false), [fetchData])

    const invalidate = useCallback(() => {
        globalCacheStore.invalidate(key)
    }, [key])

    return { data, isLoading, isRefreshing, error, refetch, invalidate }
}

// ── Mutation helper ─────────────────────────────────────────────────────────

/**
 * Wraps a server action mutation and invalidates relevant cache keys afterwards.
 * Usage: const mutate = useCacheMutation(updateContact, ["contacts*", "pipeline*"])
 */
export function useCacheMutation<TArgs extends unknown[], TResult>(
    action: (...args: TArgs) => Promise<TResult>,
    invalidateKeys: string[] = []
): (...args: TArgs) => Promise<TResult> {
    return useCallback(async (...args: TArgs) => {
        const result = await action(...args)
        for (const key of invalidateKeys) {
            globalCacheStore.invalidate(key)
        }
        return result
    }, [action, invalidateKeys])
}
