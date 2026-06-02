/**
 * Shared helpers for v1 public REST API routes. Wraps validateApiKey,
 * normalizes JSON parsing, and provides consistent error responses.
 *
 * Usage:
 *   export async function POST(req: NextRequest) {
 *     return withApiKey(req, async (ctx, body) => {
 *       // ...do work, return data
 *       return ok({ contact: ... })
 *     }, { parseJson: true })
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { validateApiKey } from "@/lib/api-auth"
import { rateLimit } from "@/lib/rate-limit"

export interface ApiContext {
    workspaceId: string
    userId: string
    apiKeyId: string
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
    return NextResponse.json(data, { status: 200, ...init })
}

export function created<T>(data: T): NextResponse {
    return NextResponse.json(data, { status: 201 })
}

export function noContent(): NextResponse {
    return new NextResponse(null, { status: 204 })
}

export function badRequest(message: string, details?: unknown): NextResponse {
    return NextResponse.json(
        { error: { code: "bad_request", message, details } },
        { status: 400 },
    )
}

export function unauthorized(): NextResponse {
    return NextResponse.json(
        {
            error: {
                code: "unauthorized",
                message:
                    "Missing or invalid API key. Pass via 'x-api-key' or 'Authorization: Bearer <key>'.",
            },
        },
        { status: 401 },
    )
}

export function tooManyRequests(message = "Rate limit exceeded"): NextResponse {
    return NextResponse.json(
        { error: { code: "rate_limit", message } },
        { status: 429, headers: { "Retry-After": "60" } },
    )
}

export function forbidden(message = "Forbidden"): NextResponse {
    return NextResponse.json(
        { error: { code: "forbidden", message } },
        { status: 403 },
    )
}

export function notFound(message = "Not found"): NextResponse {
    return NextResponse.json(
        { error: { code: "not_found", message } },
        { status: 404 },
    )
}

export function serverError(err: unknown): NextResponse {
    const message = err instanceof Error ? err.message : "Internal error"
    console.error("[v1 api] error:", err)
    return NextResponse.json(
        { error: { code: "internal", message } },
        { status: 500 },
    )
}

export interface WithApiKeyOptions {
    /** Parse the request body as JSON automatically (POST/PATCH). */
    parseJson?: boolean
}

export async function withApiKey<TBody = unknown>(
    req: NextRequest,
    handler: (ctx: ApiContext, body: TBody) => Promise<NextResponse>,
    opts: WithApiKeyOptions = {},
): Promise<NextResponse> {
    try {
        const auth = await validateApiKey(req)
        if (!auth) return unauthorized()

        // Per-key rate limit: 600 requests/min per API key. Stops a leaked
        // key from being used to flood the API while leaving plenty of
        // headroom for legitimate batch jobs.
        const { allowed } = rateLimit(`apikey:${auth.id}`, 600)
        if (!allowed) return tooManyRequests("API key over rate limit (600/min)")

        let body = {} as TBody
        if (opts.parseJson) {
            try {
                body = (await req.json()) as TBody
            } catch {
                return badRequest("Invalid JSON body")
            }
        }

        return await handler(
            {
                workspaceId: auth.workspaceId,
                userId: auth.userId,
                apiKeyId: auth.id,
            },
            body,
        )
    } catch (err) {
        return serverError(err)
    }
}
