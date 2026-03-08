export type TimelineItem =
    | { kind: "message"; id: string; type: string; direction?: string; content: string; createdAt: string }
    | { kind: "note"; id: string; content: string; authorName?: string | null; authorId?: string | null; mentions?: { userId: string; userName: string }[]; createdAt: string }
    | { kind: "note_deleted"; id: string; noteId: string; contentPreview: string | null; deletedBy: string | null; createdAt: string };

export type DuplicateContact = {
    id: string;
    name: string;
    email: string;
    phone: string;
    militaryBase: string;
    businessName: string;
    status: string;
    tags: any[];
    createdAt: string | null;
};

export type DuplicateGroup = {
    matchType: string;
    matchValue: string;
    contactIds: string[];
    contacts: DuplicateContact[];
};
