import { redirect } from "next/navigation"

/**
 * Backward-compat redirect — the canonical public form route is now
 * /forms/[formId]. Old embeds and shared links still use /form/[formId],
 * so this stub forwards them.
 */
export default async function LegacyFormRedirect({
    params,
}: {
    params: Promise<{ formId: string }>
}) {
    const { formId } = await params
    redirect(`/forms/${formId}`)
}
