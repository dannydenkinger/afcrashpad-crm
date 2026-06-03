import { redirect } from "next/navigation"

export default function RegisterPage() {
    // Self-signup is disabled in this single-org deployment. New users are
    // provisioned by an admin via Settings → Team.
    redirect("/login")
}
