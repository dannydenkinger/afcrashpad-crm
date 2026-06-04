/**
 * Export a printable profile to PDF using the browser's native print dialog.
 * Renders the provided HTML into a hidden iframe and triggers window.print().
 */
export function exportToPDF(contentHtml: string, filename: string) {
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.top = "-10000px"
  iframe.style.left = "-10000px"
  iframe.style.width = "800px"
  iframe.style.height = "600px"
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>${filename}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1a1a1a;
      padding: 40px;
      font-size: 13px;
      line-height: 1.5;
    }
    .print-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e5e5;
    }
    .print-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 600;
      color: #555;
      flex-shrink: 0;
    }
    .print-title { font-size: 22px; font-weight: 700; }
    .print-subtitle { font-size: 12px; color: #666; margin-top: 2px; }
    .print-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      background: #f0f0f0;
      font-size: 11px;
      font-weight: 500;
      margin-right: 6px;
    }
    .print-section {
      margin-bottom: 20px;
    }
    .print-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #888;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #eee;
    }
    .print-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .print-field-label {
      font-size: 11px;
      color: #888;
      margin-bottom: 1px;
    }
    .print-field-value {
      font-size: 13px;
      font-weight: 500;
    }
    .print-field-value.mono {
      font-family: "SF Mono", Monaco, monospace;
    }
    .print-notes {
      margin-top: 12px;
    }
    .print-note {
      padding: 8px 12px;
      margin-bottom: 6px;
      background: #fafafa;
      border: 1px solid #eee;
      border-radius: 6px;
    }
    .print-note-date {
      font-size: 10px;
      color: #999;
    }
    .print-note-content {
      font-size: 12px;
      margin-top: 2px;
      white-space: pre-wrap;
    }
    .print-timeline-item {
      padding: 6px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 12px;
    }
    .print-timeline-date {
      font-size: 10px;
      color: #999;
    }
    .print-footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e5e5e5;
      font-size: 10px;
      color: #aaa;
      text-align: center;
    }
    .print-financial {
      padding: 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
    }
    .print-financial-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    .col-span-2 { grid-column: span 2; }
    @media print {
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  ${contentHtml}
  <div class="print-footer">
    Exported from AFCrashpad CRM &mdash; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
  </div>
</body>
</html>`)
  doc.close()

  // Wait for content to render, then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print()
      // Clean up after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }, 250)
  }

  // Fallback: if onload doesn't fire (already loaded), trigger manually
  setTimeout(() => {
    if (iframe.parentNode) {
      iframe.contentWindow?.print()
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe)
        }
      }, 1000)
    }
  }, 500)
}
