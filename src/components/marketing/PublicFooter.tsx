import Link from "next/link"
import { Hexagon } from "lucide-react"

export function PublicFooter() {
    return (
        <footer className="relative z-10 border-t border-border/50 backdrop-blur-md">
            <div className="mx-auto max-w-5xl px-6 py-12">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <Link href="/" className="flex items-center gap-2">
                        <Hexagon className="h-5 w-5 text-violet-500" />
                        <span className="text-sm font-semibold tracking-tight">AFCrashpad CRM</span>
                    </Link>

                    <div className="flex items-center gap-x-6 gap-y-2 flex-wrap justify-center sm:justify-end">
                        <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Pricing
                        </Link>
                        <Link href="/changelog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Changelog
                        </Link>
                        <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Terms of Service
                        </Link>
                    </div>
                </div>

                <div className="mt-8 text-center sm:text-left">
                    <p className="text-xs text-muted-foreground">
                        &copy; {new Date().getFullYear()} AFCrashpad CRM. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
}
