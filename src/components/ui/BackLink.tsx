import Link from "next/link"
import { ArrowLeft } from "lucide-react"

/**
 * Small "← Back to {parent}" link used at the top of deep sub-pages
 * (e.g. /settings/integrations/ses, /marketing/email/templates/[id]).
 *
 * Pages 3+ levels deep typically lack a breadcrumb so users get stuck.
 * This component standardizes the affordance.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 group"
        >
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
            {label}
        </Link>
    )
}
