export interface CustomField {
    id: string
    name: string
    type: "text" | "number" | "date" | "dropdown" | "checkbox" | "url" | "email"
    entityType: "contact" | "deal"
    required: boolean
    options: string[]
    order: number
    createdAt: string | null
}
