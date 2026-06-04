"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react"

interface Endpoint {
    method: "GET" | "POST" | "PATCH" | "DELETE"
    path: string
    summary: string
    body?: string
    response: string
}

const ENDPOINTS: Endpoint[] = [
    {
        method: "GET",
        path: "/api/v1/contacts",
        summary: "List contacts (cursor-paginated, max 100/page)",
        body: `Query: ?limit=25&cursor=<id>&email=foo@bar.com&tag=<tagId>`,
        response: `{
  "data": [{ "id": "...", "name": "...", "email": "...", "tags": [...] }],
  "nextCursor": "abc123",
  "hasMore": true
}`,
    },
    {
        method: "POST",
        path: "/api/v1/contacts",
        summary: "Create a contact (fires contact_created automation trigger)",
        body: `{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+14155551212",
  "status": "Lead",
  "businessName": "Acme Inc",
  "customFields": { "leadScore": 50 }
}`,
        response: `{ "contact": { "id": "...", ... } }`,
    },
    {
        method: "GET",
        path: "/api/v1/contacts/{id}",
        summary: "Get one contact",
        response: `{ "contact": { "id": "...", ... } }`,
    },
    {
        method: "PATCH",
        path: "/api/v1/contacts/{id}",
        summary: "Update fields (only provided fields change; fires contact_field_updated)",
        body: `{ "status": "Customer", "phone": "+14155551313" }`,
        response: `{ "contact": { ... } }`,
    },
    {
        method: "DELETE",
        path: "/api/v1/contacts/{id}",
        summary: "Delete a contact",
        response: `(204 No Content)`,
    },
    {
        method: "POST",
        path: "/api/v1/contacts/{id}/tags",
        summary: "Add tags to a contact (idempotent; fires tag_added per new tag)",
        body: `{ "tagIds": ["abc123", "def456"] }`,
        response: `{ "added": ["abc123"], "alreadyPresent": ["def456"] }`,
    },
    {
        method: "GET",
        path: "/api/v1/lists",
        summary: "List contact lists in this workspace",
        response: `{ "data": [{ "id": "...", "name": "...", "contactCount": 12 }] }`,
    },
    {
        method: "POST",
        path: "/api/v1/lists/{id}/members",
        summary: "Add CRM contacts and/or external emails to a list",
        body: `{
  "contactIds": ["abc", "def"],
  "emails": [{ "email": "ext@example.com", "name": "Optional" }]
}`,
        response: `{
  "contactsAdded": 2,
  "contactsAlreadyPresent": 0,
  "externalEmailsAdded": 1,
  "externalEmailsAlreadyPresent": 0,
  "externalEmailsInvalid": 0
}`,
    },
    {
        method: "POST",
        path: "/api/v1/automations/{id}/enroll",
        summary: "Enroll contacts into an automation (manual enrollment)",
        body: `{
  "contactIds": ["abc"],
  "email": "alt@example.com"
}`,
        response: `{ "enrolled": 2, "skipped": 0, "runIds": ["..."] }`,
    },
]

const METHOD_COLORS: Record<Endpoint["method"], string> = {
    GET: "bg-emerald-500/10 text-emerald-700",
    POST: "bg-indigo-500/10 text-indigo-700",
    PATCH: "bg-amber-500/10 text-amber-700",
    DELETE: "bg-red-500/10 text-red-700",
}

export function ApiDocs() {
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    const toggle = (key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    return (
        <div className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-2">
                    <p>
                        All endpoints require an API key. Pass via either header:
                    </p>
                    <pre className="text-xs bg-muted p-2 rounded">{`x-api-key: afcrashpad_…
Authorization: Bearer afcrashpad_…`}</pre>
                    <p>
                        Responses are JSON. Errors come back as{" "}
                        <code>{"{ \"error\": { \"code\", \"message\" } }"}</code> with
                        appropriate 4xx/5xx status codes.
                    </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t">
                    {ENDPOINTS.map((ep) => {
                        const key = `${ep.method} ${ep.path}`
                        const isOpen = expanded.has(key)
                        return (
                            <div key={key}>
                                <button
                                    type="button"
                                    onClick={() => toggle(key)}
                                    className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-muted/40 rounded transition-colors text-left"
                                >
                                    {isOpen ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    )}
                                    <Badge
                                        variant="outline"
                                        className={`text-[10px] font-mono w-14 justify-center ${
                                            METHOD_COLORS[ep.method]
                                        } border-transparent shrink-0`}
                                    >
                                        {ep.method}
                                    </Badge>
                                    <code className="text-xs font-mono shrink-0">{ep.path}</code>
                                    <span className="text-xs text-muted-foreground truncate ml-2">
                                        {ep.summary}
                                    </span>
                                </button>
                                {isOpen && (
                                    <div className="pl-9 pr-2 pb-2 space-y-2">
                                        {ep.body && (
                                            <div>
                                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                                                    Request body
                                                </div>
                                                <pre className="text-[11px] bg-muted/40 p-2 rounded overflow-x-auto">
                                                    {ep.body}
                                                </pre>
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                                                Response
                                            </div>
                                            <pre className="text-[11px] bg-muted/40 p-2 rounded overflow-x-auto">
                                                {ep.response}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

            <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
                <div>
                    <strong className="text-foreground">Rate limits:</strong> none
                    enforced today; please be reasonable. Per-key throttling is on
                    the roadmap.
                </div>
                <div className="flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Webhook-in trigger? See the automation&apos;s settings card for
                    a per-automation public POST URL.
                </div>
            </div>
        </div>
    )
}
