"use client"

/**
 * Live thumbnail of an email template.
 *
 * Renders the email HTML in a sandboxed iframe at full width (600px) and
 * transform-scales it down to fit the tile. Pointer events are disabled so
 * the card click bubbles normally — this is decorative.
 */
export function TemplatePreview({
    html,
    height = 200,
}: {
    html: string
    height?: number
}) {
    const FULL_WIDTH = 600
    // Scale so the 600px iframe fits the container width. The container
    // measures itself via CSS — we just pick a scale that looks crisp.
    const scale = 0.46

    return (
        <div
            className="relative overflow-hidden bg-muted"
            style={{ height }}
        >
            <div
                style={{
                    width: FULL_WIDTH,
                    height: height / scale,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    pointerEvents: "none",
                }}
            >
                <iframe
                    title="Template preview"
                    srcDoc={html || EMPTY_PLACEHOLDER}
                    sandbox=""
                    style={{
                        width: FULL_WIDTH,
                        height: "100%",
                        border: 0,
                        display: "block",
                    }}
                    loading="lazy"
                />
            </div>
        </div>
    )
}

const EMPTY_PLACEHOLDER = `<html><body style="margin:0;padding:48px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;text-align:center;font-size:14px;">No content yet</body></html>`
