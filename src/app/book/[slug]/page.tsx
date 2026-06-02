import { redirect } from "next/navigation"

/**
 * Backward-compat redirect — the canonical public booking route is now
 * /booking/[slug]. Old shared links still use /book/[slug], so this
 * stub forwards them.
 */
export default async function LegacyBookRedirect({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    redirect(`/booking/${slug}`)
}
