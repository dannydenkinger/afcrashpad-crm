"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { db } from "@/lib/firebase"
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    type QueryConstraint,
    type DocumentData,
} from "firebase/firestore"

interface UseRealtimeCollectionOptions {
    /** Firestore collection path (e.g. "contacts") */
    collectionPath: string
    /** Order field (default: "createdAt") */
    orderField?: string
    /** Order direction (default: "desc") */
    orderDirection?: "asc" | "desc"
    /** Max documents to listen to (default: 200) */
    maxDocs?: number
    /** Whether the listener is active (default: true) */
    enabled?: boolean
}

interface UseRealtimeCollectionResult<T> {
    data: T[]
    isLoading: boolean
    error: string | null
}

/**
 * Hook that subscribes to a Firestore collection using onSnapshot.
 * Returns live-updating data. Falls back gracefully if Firebase client
 * is not configured (e.g. missing env vars).
 *
 * NOTE: This uses the Firebase CLIENT SDK (not admin) so it runs
 * in the browser and requires Firestore Security Rules to be configured.
 */
export function useRealtimeCollection<T extends DocumentData = DocumentData>({
    collectionPath,
    orderField = "createdAt",
    orderDirection = "desc",
    maxDocs = 200,
    enabled = true,
}: UseRealtimeCollectionOptions): UseRealtimeCollectionResult<T> {
    const [data, setData] = useState<T[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!enabled || !db) {
            setIsLoading(false)
            return
        }

        const constraints: QueryConstraint[] = [
            orderBy(orderField, orderDirection),
            limit(maxDocs),
        ]

        const q = query(collection(db, collectionPath), ...constraints)

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const docs = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as unknown as T[]
                setData(docs)
                setIsLoading(false)
                setError(null)
            },
            (err) => {
                console.error(`Realtime listener error for ${collectionPath}:`, err)
                setError(err.message)
                setIsLoading(false)
            }
        )

        return () => unsubscribe()
    }, [collectionPath, orderField, orderDirection, maxDocs, enabled])

    return { data, isLoading, error }
}

/**
 * Lightweight hook that just fires a callback when a Firestore collection changes.
 * Useful for triggering a refetch of server-action data when a write happens elsewhere.
 */
export function useRealtimeRefreshOnChange(
    collectionPath: string,
    onChangeCallback: () => void,
    enabled = true
) {
    const callbackRef = useRef(onChangeCallback)
    callbackRef.current = onChangeCallback
    const isFirstSnapshot = useRef(true)

    useEffect(() => {
        if (!enabled || !db) return

        const q = query(collection(db, collectionPath), limit(1))

        const unsubscribe = onSnapshot(
            q,
            () => {
                // Skip the initial snapshot (it fires immediately on subscribe)
                if (isFirstSnapshot.current) {
                    isFirstSnapshot.current = false
                    return
                }
                callbackRef.current()
            },
            (err) => {
                console.error(`Realtime refresh listener error for ${collectionPath}:`, err)
            }
        )

        return () => {
            unsubscribe()
            isFirstSnapshot.current = true
        }
    }, [collectionPath, enabled])
}
