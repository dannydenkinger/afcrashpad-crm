"use client"

import { useCallback, useRef } from "react"
import { toast } from "sonner"

interface UseUndoDeleteOptions {
    /** Called to soft-delete the item (mark as deleted) */
    onDelete: () => Promise<{ success: boolean; error?: string }>;
    /** Called if the user clicks Undo within the window */
    onUndo: () => Promise<{ success: boolean; error?: string }>;
    /** Called after the undo window passes to permanently remove the item */
    onPermanentDelete: () => Promise<{ success: boolean; error?: string }>;
    /** Toast message shown on deletion */
    successMessage?: string;
    /** Duration in ms before permanent deletion (default 5000) */
    duration?: number;
}

export function useUndoDelete({
    onDelete,
    onUndo,
    onPermanentDelete,
    successMessage = "Item deleted",
    duration = 5000,
}: UseUndoDeleteOptions) {
    const undoCalledRef = useRef(false);

    const execute = useCallback(async () => {
        undoCalledRef.current = false;

        const res = await onDelete();
        if (!res.success) {
            toast.error(res.error || "Delete failed");
            return false;
        }

        toast(successMessage, {
            duration,
            action: {
                label: "Undo",
                onClick: async () => {
                    undoCalledRef.current = true;
                    const undoRes = await onUndo();
                    if (undoRes.success) {
                        toast.success("Restored");
                    } else {
                        toast.error(undoRes.error || "Failed to undo");
                    }
                },
            },
            onDismiss: () => {
                if (!undoCalledRef.current) {
                    onPermanentDelete().catch(() => {});
                }
            },
            onAutoClose: () => {
                if (!undoCalledRef.current) {
                    onPermanentDelete().catch(() => {});
                }
            },
        });

        return true;
    }, [onDelete, onUndo, onPermanentDelete, successMessage, duration]);

    return { execute };
}
