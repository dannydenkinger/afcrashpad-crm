/**
 * Tenant-scoped database helper for multi-tenant workspace isolation.
 *
 * Every server action / API route should use tenantDb(workspaceId) instead of
 * importing adminDb directly.  The helper auto-injects `workspaceId` on writes
 * and auto-filters on reads so tenant data can never leak across workspaces.
 *
 * Allowed direct adminDb usage:
 *  - src/lib/firebase-admin.ts  (exports it)
 *  - src/auth.ts                (global user lookup)
 *  - src/app/register/actions.ts (workspace creation)
 *  - migration scripts
 */

import { adminDb } from "@/lib/firebase-admin"
import type { CollectionReference, DocumentReference, Query } from "firebase-admin/firestore"

export function tenantDb(workspaceId: string) {
    if (!workspaceId) {
        throw new Error("workspaceId is required for tenant-scoped queries")
    }

    return {
        /** Query a collection filtered by workspaceId */
        collection(name: string): Query {
            return adminDb.collection(name).where("workspaceId", "==", workspaceId)
        },

        /** Raw collection ref — use for .doc() lookups or when you need the ref itself */
        collectionRef(name: string): CollectionReference {
            return adminDb.collection(name)
        },

        /** Document reference by ID. `.get()` returns raw data for any
         *  workspace — read callers should pre-filter with `getOwned()` if
         *  they don't intend to expose cross-workspace data. WRITES
         *  (`.update`, `.set`, `.delete`) are wrapped with an ownership
         *  pre-check: if the doc already exists and its workspaceId
         *  doesn't match this tenant, the write is blocked. Non-existent
         *  docs (e.g. `.set()` upserts of a new ID) are allowed.
         *
         *  Batch writes — `batch.update(db.doc(...), data)` — bypass this
         *  protection because the Firestore SDK applies them via the
         *  ref's internal path, not through these wrapped methods. For
         *  batch paths, gate on `getOwned()` before pushing to the batch. */
        doc(collection: string, docId: string): DocumentReference {
            const ref = adminDb.collection(collection).doc(docId)
            const verify = async (op: string) => {
                const snap = await ref.get()
                if (snap.exists && snap.data()?.workspaceId !== workspaceId) {
                    throw new Error(
                        `tenantDb: cross-workspace ${op} blocked on ${collection}/${docId}`,
                    )
                }
            }
            return new Proxy(ref, {
                get(target, prop, receiver) {
                    if (prop === "update") {
                        return async (...args: unknown[]) => {
                            await verify("update")
                            return (target.update as (...a: unknown[]) => unknown)(...args)
                        }
                    }
                    if (prop === "delete") {
                        return async (...args: unknown[]) => {
                            await verify("delete")
                            return (target.delete as (...a: unknown[]) => unknown)(...args)
                        }
                    }
                    if (prop === "set") {
                        return async (...args: unknown[]) => {
                            await verify("set")
                            return (target.set as (...a: unknown[]) => unknown)(...args)
                        }
                    }
                    const value = Reflect.get(target, prop, receiver)
                    return typeof value === "function" ? value.bind(target) : value
                },
            })
        },

        /** Race-safe ownership check + read. Returns the doc snap if it exists
         *  AND its workspaceId matches; null otherwise. Use this whenever the
         *  doc id came from user input (bulk action selection, URL param,
         *  webhook payload, API request body). */
        async getOwned(collection: string, docId: string) {
            const snap = await adminDb.collection(collection).doc(docId).get()
            if (!snap.exists) return null
            if (snap.data()?.workspaceId !== workspaceId) return null
            return snap
        },

        /** Throw if the doc isn't in this workspace. Use in code paths that
         *  shouldn't fail silently. */
        async assertOwned(collection: string, docId: string): Promise<void> {
            const snap = await adminDb.collection(collection).doc(docId).get()
            if (!snap.exists) {
                throw new Error(`${collection}/${docId} not found`)
            }
            if (snap.data()?.workspaceId !== workspaceId) {
                throw new Error(`${collection}/${docId} not in this workspace`)
            }
        },

        /** Add a document with workspaceId automatically injected */
        async add(collection: string, data: Record<string, unknown>) {
            return adminDb.collection(collection).add({
                ...data,
                workspaceId,
            })
        },

        /** Settings document using workspace-prefixed ID convention */
        settingsDoc(settingsKey: string): DocumentReference {
            return adminDb.collection("settings").doc(`${workspaceId}_${settingsKey}`)
        },

        /** Access a subcollection under a parent document */
        subcollection(parentCollection: string, parentId: string, subName: string): CollectionReference {
            return adminDb.collection(parentCollection).doc(parentId).collection(subName)
        },

        /** Add to a subcollection with workspaceId (for collectionGroup query safety) */
        async addToSubcollection(
            parentCollection: string,
            parentId: string,
            subName: string,
            data: Record<string, unknown>,
        ) {
            return adminDb
                .collection(parentCollection)
                .doc(parentId)
                .collection(subName)
                .add({ ...data, workspaceId })
        },

        /** CollectionGroup query with tenant filter */
        collectionGroup(name: string): Query {
            return adminDb.collectionGroup(name).where("workspaceId", "==", workspaceId)
        },

        /** Batch helper — returns a Firestore batch for multi-doc writes */
        batch() {
            return adminDb.batch()
        },

        /** Get multiple docs by refs at once */
        async getAll(...refs: DocumentReference[]) {
            return adminDb.getAll(...refs)
        },

        /** The workspaceId this helper is scoped to */
        workspaceId,
    }
}

export type TenantDb = ReturnType<typeof tenantDb>
