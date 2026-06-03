import { redirect } from "next/navigation"

export default function HomePage() {
    // Single-org deployment: there's no public marketing homepage.
    // Authenticated users land on the dashboard; middleware bounces
    // unauthenticated visitors to /login.
    redirect("/dashboard")
}
