import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { sendEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

function isDue(frequency: string, lastSentAt: Date | null): boolean {
    if (!lastSentAt) return true

    const now = new Date()
    const diffMs = now.getTime() - lastSentAt.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    switch (frequency) {
        case "daily":
            return diffHours >= 23
        case "weekly":
            return diffHours >= 167 // ~7 days
        case "monthly":
            return diffHours >= 719 // ~30 days
        default:
            return false
    }
}

async function generatePipelineSummary(): Promise<string> {
    const [oppsSnap, contactsSnap] = await Promise.all([
        adminDb.collection("opportunities").get(),
        adminDb.collection("contacts").get(),
    ])

    const pipelinesSnap = await adminDb.collection("pipelines").orderBy("createdAt", "asc").get()
    const stageMap: Record<string, string> = {}
    for (const pDoc of pipelinesSnap.docs) {
        const stagesSnap = await pDoc.ref.collection("stages").orderBy("order", "asc").get()
        for (const sDoc of stagesSnap.docs) {
            stageMap[sDoc.id] = sDoc.data().name || "Unknown"
        }
    }

    const opps = oppsSnap.docs.map(d => d.data())
    const totalDeals = opps.length
    const totalValue = opps.reduce((sum, o) => sum + (o.opportunityValue || 0), 0)

    // Stage distribution
    const stageCounts: Record<string, number> = {}
    for (const opp of opps) {
        const stageName = stageMap[opp.pipelineStageId] || "Unknown"
        stageCounts[stageName] = (stageCounts[stageName] || 0) + 1
    }

    // New contacts in the last period
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const newContacts = contactsSnap.docs.filter(d => {
        const created = d.data().createdAt?.toDate?.() || new Date(0)
        return created >= oneWeekAgo
    }).length

    const stageRows = Object.entries(stageCounts)
        .map(([name, count]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${name}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${count}</td></tr>`)
        .join("")

    return `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1e40af;color:white;padding:24px;border-radius:8px 8px 0 0;">
                <h1 style="margin:0;font-size:20px;">Pipeline Summary Report</h1>
                <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <div style="display:flex;gap:16px;margin-bottom:24px;">
                    <div style="flex:1;padding:16px;background:#f0f9ff;border-radius:8px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#1e40af;">${totalDeals}</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Total Deals</div>
                    </div>
                    <div style="flex:1;padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#166534;">$${totalValue.toLocaleString()}</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Pipeline Value</div>
                    </div>
                    <div style="flex:1;padding:16px;background:#fef3c7;border-radius:8px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#92400e;">${newContacts}</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:4px;">New Contacts (7d)</div>
                    </div>
                </div>
                <h3 style="margin:0 0 12px;font-size:16px;color:#374151;">Deals by Stage</h3>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead>
                        <tr style="background:#f9fafb;">
                            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Stage</th>
                            <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Deals</th>
                        </tr>
                    </thead>
                    <tbody>${stageRows}</tbody>
                </table>
            </div>
        </div>
    `
}

async function generateContactsSummary(): Promise<string> {
    const contactsSnap = await adminDb.collection("contacts").get()
    const contacts = contactsSnap.docs.map(d => d.data())

    const totalContacts = contacts.length
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const newContacts = contacts.filter(c => {
        const created = c.createdAt?.toDate?.() || new Date(0)
        return created >= oneWeekAgo
    })

    // Status distribution
    const statusCounts: Record<string, number> = {}
    for (const c of contacts) {
        const status = c.status || "Unknown"
        statusCounts[status] = (statusCounts[status] || 0) + 1
    }

    const statusRows = Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${name}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${count}</td></tr>`)
        .join("")

    const recentRows = newContacts
        .slice(0, 10)
        .map(c => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${c.name || "Unnamed"}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${c.email || ""}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${c.militaryBase || "-"}</td></tr>`)
        .join("")

    return `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#7c3aed;color:white;padding:24px;border-radius:8px 8px 0 0;">
                <h1 style="margin:0;font-size:20px;">Contacts Summary Report</h1>
                <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <div style="display:flex;gap:16px;margin-bottom:24px;">
                    <div style="flex:1;padding:16px;background:#f5f3ff;border-radius:8px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#7c3aed;">${totalContacts}</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Total Contacts</div>
                    </div>
                    <div style="flex:1;padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#166534;">${newContacts.length}</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:4px;">New This Week</div>
                    </div>
                </div>
                <h3 style="margin:0 0 12px;font-size:16px;color:#374151;">Contacts by Status</h3>
                <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
                    <thead><tr style="background:#f9fafb;"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Status</th><th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Count</th></tr></thead>
                    <tbody>${statusRows}</tbody>
                </table>
                ${recentRows ? `
                <h3 style="margin:0 0 12px;font-size:16px;color:#374151;">Recent Contacts</h3>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead><tr style="background:#f9fafb;"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Name</th><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Email</th><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Base</th></tr></thead>
                    <tbody>${recentRows}</tbody>
                </table>` : ""}
            </div>
        </div>
    `
}

async function generateRevenueSummary(): Promise<string> {
    const oppsSnap = await adminDb.collection("opportunities").get()
    const opps = oppsSnap.docs.map(d => d.data())

    const totalValue = opps.reduce((sum, o) => sum + (o.opportunityValue || 0), 0)
    const totalProfit = opps.reduce((sum, o) => sum + (o.estimatedProfit || 0), 0)
    const avgDealValue = opps.length > 0 ? Math.round(totalValue / opps.length) : 0

    // Monthly revenue (last 6 months)
    const monthlyData: Record<string, number> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        monthlyData[key] = 0
    }
    for (const opp of opps) {
        const created = opp.createdAt?.toDate?.() || null
        if (!created) continue
        const key = created.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        if (key in monthlyData) {
            monthlyData[key] += opp.opportunityValue || 0
        }
    }

    const monthRows = Object.entries(monthlyData)
        .map(([month, value]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${month}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${value.toLocaleString()}</td></tr>`)
        .join("")

    return `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#166534;color:white;padding:24px;border-radius:8px 8px 0 0;">
                <h1 style="margin:0;font-size:20px;">Revenue Summary Report</h1>
                <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <div style="display:flex;gap:16px;margin-bottom:24px;">
                    <div style="flex:1;padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#166534;">$${totalValue.toLocaleString()}</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Total Revenue</div>
                    </div>
                    <div style="flex:1;padding:16px;background:#eff6ff;border-radius:8px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#1e40af;">$${totalProfit.toLocaleString()}</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Estimated Profit</div>
                    </div>
                    <div style="flex:1;padding:16px;background:#fef3c7;border-radius:8px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#92400e;">$${avgDealValue.toLocaleString()}</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Avg Deal Value</div>
                    </div>
                </div>
                <h3 style="margin:0 0 12px;font-size:16px;color:#374151;">Monthly Revenue (Last 6 Months)</h3>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead><tr style="background:#f9fafb;"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Month</th><th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Revenue</th></tr></thead>
                    <tbody>${monthRows}</tbody>
                </table>
            </div>
        </div>
    `
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get("secret")
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const snap = await adminDb.collection("scheduled_reports").where("enabled", "==", true).get()
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
                    html = await generatePipelineSummary()
                    subject = `Pipeline Summary Report - ${new Date().toLocaleDateString()}`
                    break
                case "contacts_summary":
                    html = await generateContactsSummary()
                    subject = `Contacts Summary Report - ${new Date().toLocaleDateString()}`
                    break
                case "revenue_summary":
                    html = await generateRevenueSummary()
                    subject = `Revenue Summary Report - ${new Date().toLocaleDateString()}`
                    break
                default:
                    continue
            }

            // Send to each recipient
            for (const recipient of (data.recipients || [])) {
                try {
                    await sendEmail({ to: recipient, subject, html })
                } catch (err) {
                    console.error(`Failed to send report to ${recipient}:`, err)
                }
            }

            // Update lastSentAt
            await doc.ref.update({ lastSentAt: new Date() })
            sent++
        }

        return NextResponse.json({ success: true, sent, skipped })
    } catch (error) {
        console.error("Send reports cron error:", error)
        return NextResponse.json({ error: "Failed to process reports" }, { status: 500 })
    }
}
