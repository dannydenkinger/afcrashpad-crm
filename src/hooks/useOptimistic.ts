"use client"

import { useState, useCallback, useRef } from "react"
import { toast } from "sonner"

/**
 * Generic hook for optimistic UI updates with automatic rollback on failure.
 *
 * Usage:
 *   const { optimisticData, execute } = useOptimisticAction(items)
 *   await execute(
 *     async () => { await serverAction(...) },            // server call
 *     (current) => current.filter(i => i.id !== id),      // optimistic updater
 *     "Failed to delete item"                             // error toast message
 *   )
 */
export function useOptimisticAction<T>(currentData: T[]) {
  const [override, setOverride] = useState<T[] | null>(null)
  const snapshotRef = useRef<T[] | null>(null)

  const optimisticData = override ?? currentData

  const execute = useCallback(
    async (
      serverAction: () => Promise<void>,
      optimisticUpdate: (items: T[]) => T[],
      errorMessage = "Action failed"
    ) => {
      // Snapshot current state for rollback
      const snapshot = override ?? currentData
      snapshotRef.current = snapshot

      // Apply optimistic update immediately
      setOverride(optimisticUpdate(snapshot))

      try {
        await serverAction()
        // On success, clear the override so the component uses fresh server data
        // (the caller typically refetches or the currentData prop updates)
        setOverride(null)
      } catch (error) {
        // Rollback to snapshot
        setOverride(snapshotRef.current)
        toast.error(errorMessage)
        throw error // re-throw so callers can handle if needed
      }
    },
    [currentData, override]
  )

  const reset = useCallback(() => setOverride(null), [])

  return { optimisticData, execute, reset }
}

/**
 * Simpler variant for single-item optimistic mutations on a state setter.
 * Captures the previous state, applies the update, and rolls back on failure.
 *
 * Usage:
 *   await optimisticMutate(
 *     setState,
 *     (prev) => prev.filter(i => i.id !== id),
 *     async () => { await deleteItem(id) },
 *     "Failed to delete"
 *   )
 */
export async function optimisticMutate<T>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  updater: (prev: T) => T,
  serverAction: () => Promise<void>,
  errorMessage = "Action failed"
): Promise<boolean> {
  let snapshot: T | undefined

  // Capture snapshot and apply optimistic update
  setState((prev) => {
    snapshot = prev
    return updater(prev)
  })

  try {
    await serverAction()
    return true
  } catch {
    // Rollback
    if (snapshot !== undefined) {
      setState(snapshot)
    }
    toast.error(errorMessage)
    return false
  }
}
