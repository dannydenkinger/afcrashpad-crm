export interface ApiKeyInfo {
    id: string
    name: string
    keyPrefix: string
    createdAt: string | null
    lastUsedAt: string | null
    active: boolean
}
