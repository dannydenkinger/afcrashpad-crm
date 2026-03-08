/**
 * Generic retry wrapper with exponential backoff.
 * Skips retries for validation/auth errors that won't succeed on retry.
 */

const NON_RETRYABLE_PATTERNS = [
  /invalid/i,
  /unauthorized/i,
  /forbidden/i,
  /not found/i,
  /validation/i,
  /permission/i,
];

function isRetryable(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error);
  return !NON_RETRYABLE_PATTERNS.some((p) => p.test(message));
}

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  delay?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoff?: number;
  /** Called before each retry */
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    onRetry,
  } = options ?? {};

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error(String(err));

      // Don't retry validation / auth errors
      if (!isRetryable(lastError)) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, lastError);
        const wait = delay * Math.pow(backoff, attempt);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  throw lastError!;
}

/**
 * Wraps a server action that returns { success, error? } so that
 * a failed result (success === false) is converted into a thrown error,
 * enabling retry logic. On final success the original result is returned.
 */
export async function withRetryAction<
  T extends { success: boolean; error?: string },
>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return withRetry(async () => {
    const result = await fn();
    if (!result.success) {
      throw new Error(result.error || "Action failed");
    }
    return result;
  }, options);
}
