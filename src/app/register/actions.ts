"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { headers } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { rateLimit } from "@/lib/rate-limit"

const registerSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    workspaceName: z.string().min(1, "Workspace name is required").max(100).optional(),
})

async function clientIp(): Promise<string> {
    const h = await headers()
    return (
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        "unknown"
    )
}

export async function registerUser(data: { name: string; email: string; password: string; workspaceName?: string }) {
    const parsed = registerSchema.safeParse(data)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    const { name, email, password } = parsed.data

    const ip = await clientIp()
    const ipLimit = rateLimit(`register-ip:${ip}`, 10)
    if (!ipLimit.allowed) {
        return { success: false, error: "Too many registration attempts. Try again in a minute." }
    }
    const emailLimit = rateLimit(`register-email:${email}`, 5)
    if (!emailLimit.allowed) {
        return { success: false, error: "Too many registration attempts. Try again in a minute." }
    }

    try {
        const existingSnap = await adminDb.collection("users")
            .where("email", "==", email)
            .limit(1)
            .get()

        if (!existingSnap.empty) {
            const existingUser = existingSnap.docs[0]
            const userData = existingUser.data()

            if (userData.passwordHash) {
                return { success: false, error: "An account with this email already exists. Try signing in instead." }
            }

            // Pre-created user (invited to a workspace) — set their password
            const passwordHash = await bcrypt.hash(password, 12)
            await existingUser.ref.update({
                name,
                passwordHash,
                updatedAt: new Date(),
            })
            return { success: true }
        }

        // Single-org mode: self-signup is DISABLED. A new email cannot create
        // its own account/workspace. An OWNER/ADMIN invites users from
        // Settings → Users (which pre-creates the user doc); the invited user
        // then sets their password via the branch above.
        return {
            success: false,
            error: "Self-signup is disabled. Ask an administrator to invite you.",
        }
    } catch (err) {
        console.error("[REGISTER] Error:", err)
        return { success: false, error: "Something went wrong. Please try again." }
    }
}

export async function checkIsFirstUser(): Promise<boolean> {
    try {
        const snap = await adminDb.collection("users").limit(1).get()
        return snap.empty
    } catch {
        return true // If Firebase isn't configured, treat as first user
    }
}
