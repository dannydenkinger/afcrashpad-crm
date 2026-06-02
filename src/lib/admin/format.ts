export function formatCents(cents: number, opts: { compact?: boolean } = {}): string {
    const dollars = cents / 100
    if (opts.compact && Math.abs(dollars) >= 1000) {
        return `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}k`
    }
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: dollars < 100 ? 2 : 0,
    }).format(dollars)
}

export function formatNumber(n: number): string {
    return new Intl.NumberFormat("en-US").format(n)
}

export function formatPercent(pct: number, fractionDigits = 1): string {
    return `${pct.toFixed(fractionDigits)}%`
}

export function formatDate(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    })
}

export function formatRelative(iso: string | null): string {
    if (!iso) return "—"
    const now = Date.now()
    const t = new Date(iso).getTime()
    const diff = now - t
    if (diff < 60_000) return "just now"
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`
    if (diff < day) return `${Math.floor(diff / hour)}h ago`
    if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`
    if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}mo ago`
    return `${Math.floor(diff / (365 * day))}y ago`
}
