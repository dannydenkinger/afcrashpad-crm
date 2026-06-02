import Link from "next/link"
import { ArrowRight, Upload, Download } from "lucide-react"

export interface DataTile {
    href: string
    Icon: React.ComponentType<{ className?: string }>
    title: string
    desc: string
    accent: "blue" | "violet" | "emerald" | "amber" | "rose"
}

export function DataTileCard({
    href,
    Icon,
    title,
    desc,
    accent,
    kind,
}: DataTile & { kind: "import" | "export" }) {
    const tone = {
        blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
        violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
        emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
        amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
        rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
    }[accent]
    const KindIcon = kind === "import" ? Upload : Download
    return (
        <Link href={href}>
            <div className="group relative rounded-xl border bg-card p-4 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all h-full">
                <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-semibold text-sm group-hover:text-primary transition-colors">
                            {title}
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</div>
                    </div>
                    <div className="text-muted-foreground/40 shrink-0">
                        <KindIcon className="w-3.5 h-3.5" />
                    </div>
                </div>
            </div>
        </Link>
    )
}
