import "@/lib/firebase-admin" // ensure adminDb is on globalThis before JWT callback runs
import { handlers } from "@/auth"
export const { GET, POST } = handlers
