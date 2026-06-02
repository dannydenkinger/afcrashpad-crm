import Link from "next/link"
import { ArrowRight, Calendar } from "lucide-react"
import { SettingsSubPage } from "../../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

/**
 * The full booking-page configuration UI lives at /settings/booking
 * (separate area with its own forms). This sub-page is just an entry
 * tile pointing there, so the workspace nav has a complete list.
 */
export default function BookingPage() {
    return (
        <SettingsSubPage
            title="Booking page"
            description="Public scheduling link, business hours, appointment types."
        >
            <Link href="/settings/booking">
                <div className="rounded-lg border bg-card hover:border-primary/30 hover:bg-muted/30 transition-colors cursor-pointer py-3 px-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">Configure booking page</div>
                        <div className="text-xs text-muted-foreground">
                            Public scheduling link, hours, appointment types.
                        </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                </div>
            </Link>
        </SettingsSubPage>
    )
}
