/**
 * Scheduled Reports Processor
 *
 * Checks for due scheduled reports and sends them via email.
 * Called from the main daily cron and the dedicated cron endpoint.
 */

import { tenantDb } from "@/lib/tenant-db"
import { sendEmail } from "@/lib/email"

function isDue(frequency: string, lastSentAt: Date | null): boolean {
    if (!lastSentAt) return true

    const now = new Date()
    const diffMs = now.getTime() - lastSentAt.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    switch (frequency) {
        case "daily":
            return diffHours >= 23
        case "weekly":
            return diffHours >= 167
        case "monthly":
            return diffHours >= 719
        default:
            return false
    }
}

async function generatePipelineSummaryHtml(workspaceId: string): Promise<string> {
    const db = tenantDb(workspaceId)

    const [oppsSnap, contactsSnap] = await Promise.all([
        db.collection("opportunities").get(),
        db.collection("contacts").get(),
    ])

    const pipelinesSnap = await db.collection("pipelines").orderBy("createdAt", "asc").get()
    const stageMap: Record<string, string> = {}
    for (const pDoc of pipelinesSnap.docs) {
        const stagesSnap = await db.subcollection("pipelines", pDoc.id, "stages").orderBy("order", "asc").get()
        for (const sDoc of stagesSnap.docs) {
            stageMap[sDoc.id] = sDoc.data().name || "Unknown"
        }
    }

    const opps = oppsSnap.docs.map(d => d.data())
    const totalDeals = opps.length
    const totalValue = opps.reduce((sum, o) => sum + (o.opportunityValue || 0), 0)

    const stageCounts: Record<string, number> = {}
    for (const opp of opps) {
        const stageName = stageMap[opp.pipelineStageId] || "Unknown"
        stageCounts[stageName] = (stageCounts[stageName] || 0) + 1
    }

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const newContacts = contactsSnap.docs.filter(d => {
        const created = d.data().createdAt?.toDate?.() || new Date(0)
        return created >= oneWeekAgo
    }).length

    const stageRows = Object.entries(stageCounts)
        .map(([name, count]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${name}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${count}</td></tr>`)
        .join("")

    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1e40af;color:white;padding:24px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:20px;">Pipeline Summary Report</h1>
            <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <table style="width:100%;margin-bottom:24px;"><tr>
                <td style="padding:16px;background:#f0f9ff;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#1e40af;">${totalDeals}</div><div style="font-size:12px;color:#6b7280;">Total Deals</div></td>
                <td style="width:16px;"></td>
                <td style="padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#166534;">$${totalValue.toLocaleString()}</div><div style="font-size:12px;color:#6b7280;">Pipeline Value</div></td>
                <td style="width:16px;"></td>
                <td style="padding:16px;background:#fef3c7;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#92400e;">${newContacts}</div><div style="font-size:12px;color:#6b7280;">New Contacts (7d)</div></td>
            </tr></table>
            <h3 style="margin:0 0 12px;font-size:16px;">Deals by Stage</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead><tr style="background:#f9fafb;"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Stage</th><th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Deals</th></tr></thead>
                <tbody>${stageRows}</tbody>
            </table>
        </div>
    </div>`
}

async function generateContactsSummaryHtml(workspaceId: string): Promise<string> {
    const db = tenantDb(workspaceId)

    const contactsSnap = await db.collection("contacts").get()
    const contacts = contactsSnap.docs.map(d => d.data())
    const totalContacts = contacts.length

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const newCount = contacts.filter(c => {
        const created = c.createdAt?.toDate?.() || new Date(0)
        return created >= oneWeekAgo
    }).length

    const statusCounts: Record<string, number> = {}
    for (const c of contacts) {
        const status = c.status || "Unknown"
        statusCounts[status] = (statusCounts[status] || 0) + 1
    }

    const rows = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${name}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${count}</td></tr>`)
        .join("")

    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#7c3aed;color:white;padding:24px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:20px;">Contacts Summary Report</h1>
            <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <table style="width:100%;margin-bottom:24px;"><tr>
                <td style="padding:16px;background:#f5f3ff;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#7c3aed;">${totalContacts}</div><div style="font-size:12px;color:#6b7280;">Total</div></td>
                <td style="width:16px;"></td>
                <td style="padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#166534;">${newCount}</div><div style="font-size:12px;color:#6b7280;">New This Week</div></td>
            </tr></table>
            <h3 style="margin:0 0 12px;font-size:16px;">By Status</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead><tr style="background:#f9fafb;"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Status</th><th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Count</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    </div>`
}

async function generateRevenueSummaryHtml(workspaceId: string): Promise<string> {
    const db = tenantDb(workspaceId)

    const oppsSnap = await db.collection("opportunities").get()
    const opps = oppsSnap.docs.map(d => d.data())

    const totalValue = opps.reduce((sum, o) => sum + (o.opportunityValue || 0), 0)
    const totalProfit = opps.reduce((sum, o) => sum + (o.estimatedProfit || 0), 0)
    const avgDealValue = opps.length > 0 ? Math.round(totalValue / opps.length) : 0

    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#166534;color:white;padding:24px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:20px;">Revenue Summary Report</h1>
            <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <table style="width:100%;margin-bottom:24px;"><tr>
                <td style="padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#166534;">$${totalValue.toLocaleString()}</div><div style="font-size:12px;color:#6b7280;">Total Revenue</div></td>
                <td style="width:16px;"></td>
                <td style="padding:16px;background:#eff6ff;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#1e40af;">$${totalProfit.toLocaleString()}</div><div style="font-size:12px;color:#6b7280;">Est. Profit</div></td>
                <td style="width:16px;"></td>
                <td style="padding:16px;background:#fef3c7;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#92400e;">$${avgDealValue.toLocaleString()}</div><div style="font-size:12px;color:#6b7280;">Avg Deal</div></td>
            </tr></table>
        </div>
    </div>`
}

export async function processScheduledReports(workspaceId: string): Promise<{
    success: boolean
    sent: number
    skipped: number
}> {
    const db = tenantDb(workspaceId)

    const snap = await db.collection("scheduled_reports").where("enabled", "==", true).get()
    let sent = 0
    let skipped = 0

    for (const doc of snap.docs) {
        const data = doc.data()
        const lastSentAt = data.lastSentAt?.toDate?.() || null

        if (!isDue(data.frequency, lastSentAt)) {
            skipped++
            continue
        }

        let html: string
        let subject: string

        switch (data.reportType) {
            case "pipeline_summary":
                html = await generatePipelineSummaryHtml(workspaceId)
                subject = `Pipeline Summary Report - ${new Date().toLocaleDateString()}`
                break
            case "contacts_summary":
                html = await generateContactsSummaryHtml(workspaceId)
                subject = `Contacts Summary Report - ${new Date().toLocaleDateString()}`
                break
            case "revenue_summary":
                html = await generateRevenueSummaryHtml(workspaceId)
                subject = `Revenue Summary Report - ${new Date().toLocaleDateString()}`
                break
            default:
                continue
        }

        for (const recipient of (data.recipients || [])) {
            try {
                await sendEmail({ to: recipient, subject, html })
            } catch (err) {
                console.error(`Failed to send report to ${recipient}:`, err)
            }
        }

        await doc.ref.update({ lastSentAt: new Date() })
        sent++
    }

    return { success: true, sent, skipped }
}
