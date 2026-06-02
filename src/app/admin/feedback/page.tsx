import { listFeedback } from "./actions"
import { FeedbackInbox } from "./FeedbackInbox"

export const dynamic = "force-dynamic"

export default async function FeedbackPage() {
    const entries = await listFeedback()
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Everything submitted through the in-app Feedback button. Triage by
                    setting status — entries don&apos;t auto-clear, you can always re-find
                    them.
                </p>
            </header>
            <FeedbackInbox initial={entries} />
        </div>
    )
}
