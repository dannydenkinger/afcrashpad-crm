/** Shared contact mapper for v1 API routes. */

export interface ContactPayload {
    id: string
    name: string
    email: string | null
    phone: string | null
    status: string | null
    businessName: string | null
    tags: Array<{ tagId: string; name?: string; color?: string }>
    createdAt: string
    updatedAt: string
}

export function tsToISO(ts: unknown): string {
    if (!ts) return ""
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
        return (ts as { toDate: () => Date }).toDate().toISOString()
    }
    if (ts instanceof Date) return ts.toISOString()
    return typeof ts === "string" ? ts : ""
}

export function mapContact(id: string, data: Record<string, unknown>): ContactPayload {
    return {
        id,
        name: (data.name as string) ?? "",
        email: (data.email as string) ?? null,
        phone: (data.phone as string) ?? null,
        status: (data.status as string) ?? null,
        businessName: (data.businessName as string) ?? null,
        tags: ((data.tags as ContactPayload["tags"]) ?? []) as ContactPayload["tags"],
        createdAt: tsToISO(data.createdAt),
        updatedAt: tsToISO(data.updatedAt),
    }
}
