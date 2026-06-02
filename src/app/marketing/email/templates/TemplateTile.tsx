"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react"
import { deleteTemplateAction } from "../actions"
import { TemplatePreview } from "./TemplatePreview"

interface Props {
    template: {
        id: string
        name: string
        subject: string
        description?: string
        renderedHtml: string
        updatedAt: string
    }
}

export function TemplateTile({ template }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [removed, setRemoved] = useState(false)

    const handleDelete = () => {
        if (
            !confirm(
                `Delete "${template.name}"? This can't be undone — campaigns referencing it will keep their saved HTML.`,
            )
        ) {
            return
        }
        startTransition(async () => {
            const result = await deleteTemplateAction(template.id)
            if (!result.success) {
                toast.error(result.error || "Failed to delete")
                return
            }
            setRemoved(true)
            toast.success("Template deleted")
            router.refresh()
        })
    }

    if (removed) return null

    return (
        <Card
            className={`relative group transition-all duration-150 h-full overflow-hidden p-0 ${
                isPending
                    ? "opacity-60"
                    : "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40"
            }`}
        >
            <Link
                href={`/marketing/email/templates/${template.id}`}
                className="block"
            >
                <TemplatePreview html={template.renderedHtml} height={180} />
                <div className="p-4 pr-12 space-y-1">
                    <div className="font-semibold text-sm truncate">
                        {template.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                        {template.subject || "(no subject)"}
                    </div>
                    {template.description && (
                        <div className="text-xs text-muted-foreground/80 line-clamp-1 pt-0.5">
                            {template.description}
                        </div>
                    )}
                    <div className="text-[10px] text-muted-foreground/70 pt-1.5">
                        Updated {new Date(template.updatedAt).toLocaleDateString()}
                    </div>
                </div>
            </Link>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 bg-background/90 backdrop-blur shadow-sm"
                            onClick={(e) => e.stopPropagation()}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <MoreHorizontal className="w-4 h-4" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <DropdownMenuItem
                            onSelect={() =>
                                router.push(`/marketing/email/templates/${template.id}`)
                            }
                        >
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={handleDelete}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </Card>
    )
}
