import { cn } from "@/lib/utils"

export interface TestimonialAuthor {
    name: string
    role: string
    company: string
    avatar?: string
}

interface TestimonialCardProps {
    author: TestimonialAuthor
    text: string
    href?: string
    className?: string
}

export function TestimonialCard({ author, text, href, className }: TestimonialCardProps) {
    const content = (
        <div className={cn(
            "flex w-[22rem] shrink-0 flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm",
            className
        )}>
            <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{text}&rdquo;</p>
            <div className="flex items-center gap-3 mt-auto">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {author.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={author.avatar} alt={author.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                        author.name.split(" ").map(n => n[0]).join("").slice(0, 2)
                    )}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{author.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{author.role}, {author.company}</p>
                </div>
            </div>
        </div>
    )

    if (href) {
        return <a href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">{content}</a>
    }

    return content
}
