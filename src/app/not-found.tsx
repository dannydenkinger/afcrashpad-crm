import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plane } from "lucide-react"

export default function NotFound() {
    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 mb-6">
                    <Plane className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-4xl font-bold tracking-tight mb-2">404</h2>
                <p className="text-lg text-muted-foreground mb-1">Page not found</p>
                <p className="text-sm text-muted-foreground max-w-md mb-8">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Button asChild>
                    <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
            </div>
        </div>
    )
}
