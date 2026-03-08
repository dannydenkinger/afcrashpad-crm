export type SearchResult =
    | { id: string; name: string; email?: string; type: "contact" }
    | { id: string; name: string; contactId: string; contactName: string; type: "opportunity" }
    | { id: string; content: string; contactId: string; contactName: string; type: "note" };
