"use client";

import { useState, useCallback, useRef } from "react";
import { withRetry, type RetryOptions } from "@/lib/retry";
import { toast } from "sonner";

/**
 * React hook that wraps an async function with retry + exponential backoff.
 * Shows a subtle toast on each retry attempt.
 */
export function useRetryAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options?: RetryOptions
): {
  execute: (...args: TArgs) => Promise<TResult>;
  isRetrying: boolean;
  retryCount: number;
} {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = options?.maxRetries ?? 3;

  // Keep a stable ref to the action so callers don't need to memoize it
  const actionRef = useRef(action);
  actionRef.current = action;

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setRetryCount(0);
      setIsRetrying(false);

      try {
        return await withRetry(() => actionRef.current(...args), {
          ...options,
          maxRetries,
          onRetry: (attempt, error) => {
            setIsRetrying(true);
            setRetryCount(attempt);
            toast.info(`Retrying... (attempt ${attempt + 1}/${maxRetries + 1})`, {
              duration: 2000,
              id: "retry-toast",
            });
            options?.onRetry?.(attempt, error);
          },
        });
      } finally {
        setIsRetrying(false);
        setRetryCount(0);
      }
    },
    [maxRetries, options]
  );

  return { execute, isRetrying, retryCount };
}
