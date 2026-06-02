import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { getList, listLists, listMembers } from "@/lib/lists/contact-lists"
import { ListDetailClient, type ListMemberRow } from "./ListDetailClient"
import { SmartSegmentEditor } from "./SmartSegmentEditor"

export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ListDetailPage({ params }: PageProps) {
    const { id } = await params
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const list = await getList(workspaceId, id)
    if (!list) notFound()

    const isSmart = list.type === "smart"

    // Members: live evaluation for smart segments, stored membership for static.
    const members = await listMembers(workspaceId, id, 200)
    const liveCount = isSmart ? members.length : list.contactCount

    // Hydrate CRM members with name/email from the contacts collection.
    const crmContactIds = members
        .filter((m) => m.kind === "crm")
        .map((m) => m.contactId)
    const crmContactsById = await loadContactsById(workspaceId, crmContactIds)

    const memberRows: ListMemberRow[] = members.map((m) => {
        if (m.kind === "external") {
            return {
                memberId: m.memberId,
                kind: "external",
                email: m.email,
                name: m.name ?? "",
            }
        }
        const c = crmContactsById.get(m.contactId)
        return {
            memberId: m.memberId,
            kind: "crm",
            contactId: m.contactId,
            email: c?.email ?? "",
            name: c?.name ?? "",
        }
    })

    memberRows.sort((a, b) =>
        (a.name || a.email).toLowerCase().localeCompare(
            (b.name || b.email).toLowerCase(),
        ),
    )

    // Smart-segment editor needs tags + other lists for rule pickers.
    const [tagsSnap, allLists] = isSmart
        ? await Promise.all([
              adminDb
                  .collection("tags")
                  .where("workspaceId", "==", workspaceId)
                  .limit(200)
                  .get(),
              listLists(workspaceId),
          ])
        : [null, []]
    const tags = tagsSnap
        ? tagsSnap.docs.map((d) => ({
              id: d.id,
              name: (d.data().name as string) ?? "(untitled)",
              color: (d.data().color as string) ?? "#94a3b8",
          }))
        : []
    const otherLists = allLists
        .filter((l) => l.id !== id && l.type !== "smart")
        .map((l) => ({ id: l.id, name: l.name }))

    return (
        <div className="container mx-auto max-w-5xl py-10 px-4 space-y-6">
            <div>
                <div className="text-xs text-muted-foreground mb-1">
                    <Link href="/marketing/email/lists" className="hover:underline">
                        ← Contact lists
                    </Link>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <h1 className="text-2xl font-semibold">{list.name}</h1>
                    {isSmart && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            Smart segment
                        </span>
                    )}
                </div>
                {list.description && (
                    <p className="text-sm text-muted-foreground mt-1">{list.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                    {liveCount.toLocaleString()}{" "}
                    {liveCount === 1 ? "member" : "members"}
                    {isSmart && (
                        <span className="ml-1.5 text-muted-foreground/70">
                            (live · re-evaluates on every load)
                        </span>
                    )}
                </p>
            </div>

            {isSmart && (
                <SmartSegmentEditor
                    listId={list.id}
                    initialRules={list.rules ?? []}
                    initialCombinator={list.combinator ?? "and"}
                    tags={tags}
                    otherLists={otherLists}
                />
            )}

            <ListDetailClient
                listId={list.id}
                listName={list.name}
                initialMembers={memberRows}
                initialCount={liveCount}
                isSmart={isSmart}
            />
        </div>
    )
}

async function loadContactsById(
    workspaceId: string,
    contactIds: string[],
): Promise<Map<string, { name: string; email: string }>> {
    const out = new Map<string, { name: string; email: string }>()
    if (contactIds.length === 0) return out
    for (let i = 0; i < contactIds.length; i += 30) {
        const chunk = contactIds.slice(i, i + 30)
        const snap = await adminDb
            .collection("contacts")
            .where("workspaceId", "==", workspaceId)
            .where("__name__", "in", chunk)
            .get()
        for (const d of snap.docs) {
            const data = d.data()
            out.set(d.id, {
                name: (data.name as string) ?? "",
                email: (data.email as string) ?? "",
            })
        }
    }
    return out
}
