import { type DefaultSession } from "next-auth"

declare module "next-auth" {
    /**
     * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            /** The user's role within the current workspace. */
            role: string
            /** The active workspace ID. */
            workspaceId: string
        } & DefaultSession["user"]
    }

    interface User {
        role: string
    }
}

declare module "@auth/core/adapters" {
    interface AdapterUser {
        role: string
    }
}
