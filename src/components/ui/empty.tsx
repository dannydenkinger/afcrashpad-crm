import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("flex flex-col items-center justify-center text-center p-8", className)} {...props} />
    )
}

function EmptyHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("flex flex-col items-center gap-2 mb-6", className)} {...props} />
    )
}

function EmptyTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h2 className={cn("text-4xl font-bold tracking-tight", className)} {...props} />
    )
}

function EmptyDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p className={cn("text-muted-foreground text-lg", className)} {...props} />
    )
}

function EmptyContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("flex flex-col items-center gap-4", className)} {...props} />
    )
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent }
