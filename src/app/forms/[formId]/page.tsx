import { notFound } from "next/navigation"
import { adminDb } from "@/lib/firebase-admin"
import { FormRenderer } from "@/components/forms/FormRenderer"
import { getGoogleFontUrl } from "@/lib/form-utils"
import type { LeadForm } from "@/app/settings/lead-forms/types"
import type { Metadata } from "next"

interface Props {
    params: Promise<{ formId: string }>
}

async function getForm(formId: string): Promise<LeadForm | null> {
    const doc = await adminDb.collection("lead_forms").doc(formId).get()
    if (!doc.exists) return null
    const d = doc.data()!
    if (d.status !== "active") return null
    return {
        id: doc.id,
        workspaceId: d.workspaceId,
        name: d.name,
        slug: d.slug,
        status: d.status,
        apiKeyHash: d.apiKeyHash || "",
        apiKeyPrefix: d.apiKeyPrefix || "",
        fields: d.fields || [],
        style: d.style || {},
        submissionCount: d.submissionCount || 0,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() || "",
        updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() || "",
    } as LeadForm
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { formId } = await params
    const form = await getForm(formId)
    if (!form) return { title: "Form Not Found" }
    return {
        title: form.style.title || form.name,
        description: form.style.description || `Fill out the ${form.name} form`,
    }
}

export default async function FormPage({ params }: Props) {
    const { formId } = await params
    const form = await getForm(formId)
    if (!form) notFound()

    const googleFontUrl = getGoogleFontUrl(form.style.fontFamily)

    return (
        <html lang="en">
            <head>
                {googleFontUrl && <link rel="stylesheet" href={googleFontUrl} />}
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <style dangerouslySetInnerHTML={{ __html: `
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { min-height: 100vh; }
                    input:focus, textarea:focus, select:focus { outline: none; }
                ` }} />
            </head>
            <body style={{ backgroundColor: form.style.backgroundColor, minHeight: "100vh" }}>
                <FormRenderer form={form} mode="live" />
            </body>
        </html>
    )
}
