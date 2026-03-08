/**
 * Generates printable HTML strings for contact and deal profiles.
 * These are rendered into a hidden iframe by export-pdf.ts for printing.
 */

function escapeHtml(str: string): string {
  if (!str) return ""
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

function formatCurrency(val: number | string | null | undefined): string {
  const num = Number(val)
  if (!num && num !== 0) return "$0"
  return `$${num.toLocaleString()}`
}

function field(label: string, value: string | null | undefined, className = ""): string {
  return `<div class="${className}">
    <div class="print-field-label">${escapeHtml(label)}</div>
    <div class="print-field-value">${escapeHtml(value || "N/A")}</div>
  </div>`
}

// ---------- Contact Profile ----------

export function buildContactProfileHtml(contact: any): string {
  const initials = (contact.name || "?").charAt(0).toUpperCase()

  const badges: string[] = []
  if (contact.status) badges.push(`<span class="print-badge">${escapeHtml(contact.status)}</span>`)
  if (contact.utmSource) badges.push(`<span class="print-badge">via ${escapeHtml(contact.utmSource)}</span>`)

  const notesHtml = (contact.notes || [])
    .map((note: any) => `
      <div class="print-note">
        <div class="print-note-date">${formatDate(note.createdAt)}</div>
        <div class="print-note-content">${escapeHtml(note.content)}</div>
      </div>
    `)
    .join("")

  const opportunitiesHtml = (contact.opportunities || [])
    .map((opp: any) => `
      <div class="print-timeline-item">
        <strong>${escapeHtml(opp.name || "Deal")}</strong>
        ${opp.opportunityValue != null ? ` &mdash; ${formatCurrency(opp.opportunityValue)}` : ""}
      </div>
    `)
    .join("")

  return `
    <div class="print-header">
      <div class="print-avatar">${initials}</div>
      <div>
        <div class="print-title">${escapeHtml(contact.name)}</div>
        <div class="print-subtitle">${badges.join(" ")}</div>
      </div>
    </div>

    <div class="print-section">
      <div class="print-section-title">Contact Information</div>
      <div class="print-grid">
        ${field("Full Name", contact.name, "col-span-2")}
        ${field("Email Address", contact.email)}
        ${field("Phone Number", contact.phone)}
        ${field("Business Name", contact.businessName, "col-span-2")}
        ${field("Military Base", contact.militaryBase, "col-span-2")}
      </div>
    </div>

    <div class="print-section">
      <div class="print-section-title">Status &amp; Stay Dates</div>
      <div class="print-grid">
        ${field("Status", contact.status)}
        ${field("Stay Start", formatDate(contact.stayStartDate))}
        ${field("Stay End", formatDate(contact.stayEndDate))}
      </div>
    </div>

    ${opportunitiesHtml ? `
    <div class="print-section">
      <div class="print-section-title">Deal History</div>
      ${opportunitiesHtml}
    </div>
    ` : ""}

    ${notesHtml ? `
    <div class="print-section">
      <div class="print-section-title">Notes</div>
      <div class="print-notes">${notesHtml}</div>
    </div>
    ` : ""}
  `
}

// ---------- Deal Profile ----------

export function buildDealProfileHtml(deal: any): string {
  const initials = (deal.name || "?").slice(0, 2).toUpperCase()

  const notesHtml = (deal.contactNotes || deal.notes || [])
    .map((note: any) => `
      <div class="print-note">
        <div class="print-note-date">${formatDate(note.createdAt)}</div>
        <div class="print-note-content">${escapeHtml(note.content)}</div>
      </div>
    `)
    .join("")

  const tagsHtml = (deal.tags || [])
    .map((t: any) => `<span class="print-badge">${escapeHtml(t.tagName || t.tagId || "")}</span>`)
    .join(" ")

  return `
    <div class="print-header">
      <div class="print-avatar">${initials}</div>
      <div>
        <div class="print-title">${escapeHtml(deal.name || "Opportunity")}</div>
        <div class="print-subtitle">
          <span class="print-badge">${escapeHtml(deal.stage || "")}</span>
          in Pipeline
        </div>
      </div>
    </div>

    <div class="print-section">
      <div class="print-section-title">Contact Information</div>
      <div class="print-grid">
        ${field("Full Name", deal.name, "col-span-2")}
        ${field("Email Address", deal.email)}
        ${field("Phone Number", deal.phone)}
        ${field("Military Base", deal.base, "col-span-2")}
      </div>
    </div>

    <div class="print-section">
      <div class="print-section-title">Stay Details</div>
      <div class="print-grid">
        ${field("Check-in Date", formatDate(deal.startDate))}
        ${field("Check-out Date", formatDate(deal.endDate))}
        ${field("Pipeline Stage", deal.stage)}
        ${field("Assigned To", deal.assigneeName || "Unassigned")}
      </div>
    </div>

    <div class="print-section">
      <div class="print-section-title">Financial Details</div>
      <div class="print-financial">
        <div class="print-financial-row">
          <span>Opportunity Value</span>
          <span class="print-field-value mono">${formatCurrency(deal.value)}</span>
        </div>
        <div class="print-financial-row">
          <span>Expected Profit Margin (25%)</span>
          <span class="print-field-value mono" style="color: #16a34a; font-weight: 700;">${formatCurrency(deal.margin)}</span>
        </div>
      </div>
    </div>

    ${deal.claimedByName ? `
    <div class="print-section">
      <div class="print-section-title">Claimed By</div>
      <div class="print-field-value">${escapeHtml(deal.claimedByName)}</div>
    </div>
    ` : ""}

    ${tagsHtml ? `
    <div class="print-section">
      <div class="print-section-title">Tags</div>
      <div>${tagsHtml}</div>
    </div>
    ` : ""}

    ${notesHtml ? `
    <div class="print-section">
      <div class="print-section-title">Notes</div>
      <div class="print-notes">${notesHtml}</div>
    </div>
    ` : ""}
  `
}
