import { useState, useEffect, useRef, useCallback } from "react"

/**
 * Returns a debounced version of `value`.
 * The returned value only updates after `delay` ms of inactivity.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])

    return debouncedValue
}

/**
 * Returns a debounced version of `callback`.
 * The callback is only invoked after `delay` ms since the last call.
 * The returned function is stable across renders.
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
): T {
    const callbackRef = useRef(callback)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    // Always keep the latest callback reference
    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    const debouncedFn = useCallback(
        (...args: Parameters<T>) => {
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                callbackRef.current(...args)
            }, delay)
        },
        [delay]
    ) as T

    return debouncedFn
}
