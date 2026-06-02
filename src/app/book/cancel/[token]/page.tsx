import { redirect } from "next/navigation"

/**
 * Backward-compat redirect — booking cancel is now /booking/cancel/[token].
 * Cancel links in already-sent confirmation emails still use the old path.
 */
export default async function LegacyCancelRedirect({
    params,
}: {
    params: Promise<{ token: string }>
}) {
    const { token } = await params
    redirect(`/booking/cancel/${token}`)
}
