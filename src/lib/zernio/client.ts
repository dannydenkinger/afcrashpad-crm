/**
 * Zernio HTTP client.
 *
 * Platform-level credentials (env vars) are used — each Company/workspace
 * operates as its own Zernio *sub-account*, identified by `zernio_account_id`
 * stored on the workspace. The API key is the platform's, not per-tenant.
 *
 * Env vars:
 *   ZERNIO_API_KEY         - platform API key
 *   ZERNIO_BASE_URL        - optional override; defaults to https://api.zernio.com
 *   ZERNIO_WEBHOOK_SECRET  - HMAC secret for webhook verification
 *
 * Endpoint/payload shapes below are best-effort based on Zernio's documented
 * Connect flow + /posts endpoint. Adjust if their real API differs.
 */

export interface ZernioRequestOptions {
    method?: "GET" | "POST" | "PATCH" | "DELETE"
    body?: Record<string, unknown>
    query?: Record<string, string | number | boolean | undefined>
}

export class ZernioError extends Error {
    constructor(
        message: string,
        public status: number,
        public responseBody?: unknown,
    ) {
        super(message)
        this.name = "ZernioError"
    }
}

export class ZernioNotConfiguredError extends Error {
    constructor() {
        super(
            "Zernio is not configured. Set ZERNIO_API_KEY in the environment to enable the social planner.",
        )
        this.name = "ZernioNotConfiguredError"
    }
}

function getApiKey(): string {
    const key = process.env.ZERNIO_API_KEY
    if (!key) throw new ZernioNotConfiguredError()
    return key
}

function getBaseUrl(): string {
    return process.env.ZERNIO_BASE_URL || "https://api.zernio.com"
}

export function isZernioConfigured(): boolean {
    return !!process.env.ZERNIO_API_KEY
}

export function getWebhookSecret(): string | null {
    return process.env.ZERNIO_WEBHOOK_SECRET || null
}

function buildUrl(path: string, query?: ZernioRequestOptions["query"]): string {
    const base = getBaseUrl().replace(/\/$/, "")
    const p = path.startsWith("/") ? path : `/${path}`
    const url = new URL(base + p)
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined) continue
            url.searchParams.set(k, String(v))
        }
    }
    return url.toString()
}

export async function zernioRequest<T = unknown>(
    path: string,
    opts: ZernioRequestOptions = {},
): Promise<T> {
    const apiKey = getApiKey()
    const url = buildUrl(path, opts.query)
    const method = opts.method ?? "GET"

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
    }
    let body: string | undefined
    if (opts.body !== undefined) {
        body = JSON.stringify(opts.body)
        headers["Content-Type"] = "application/json"
    }

    const res = await fetch(url, { method, headers, body })
    const text = await res.text()
    const parsed = text ? safeParseJson(text) : undefined

    if (!res.ok) {
        const message =
            (parsed && typeof parsed === "object" && "message" in parsed
                ? String((parsed as { message: unknown }).message)
                : null) ||
            `Zernio ${method} ${path} failed: ${res.status} ${res.statusText}`
        throw new ZernioError(message, res.status, parsed)
    }

    return (parsed as T) ?? (undefined as unknown as T)
}

function safeParseJson(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}
