import { Megaphone } from "lucide-react"
import { PublicNav } from "@/components/marketing/PublicNav"
import { PublicFooter } from "@/components/marketing/PublicFooter"
import { Changelog } from "@/components/marketing/Changelog"

export const metadata = {
    title: "Changelog | Vesta CRM",
    description: "Recent updates and improvements to Vesta CRM.",
}

export default function ChangelogPage() {
    return (
        <div className="relative min-h-screen flex flex-col">
            <PublicNav />

            <main className="flex-1 relative z-10">
                <div className="mx-auto max-w-3xl px-6 pt-20 pb-16">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full mb-4">
                            <Megaphone className="w-3 h-3" />
                            Changelog
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                            What&rsquo;s new in Vesta
                        </h1>
                        <p className="text-base text-muted-foreground mt-4 max-w-xl mx-auto">
                            Every release notes new features, fixes, and improvements.
                            Subscribe to our newsletter to get them first.
                        </p>
                    </div>

                    <Changelog />
                </div>
            </main>

            <PublicFooter />
        </div>
    )
}
