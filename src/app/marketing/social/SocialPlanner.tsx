"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
    Loader2,
    Send,
    Calendar as CalendarIcon,
    List,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Upload,
    X,
    User,
} from "lucide-react"
import type { SocialAccount, SocialPlatform, SocialPost, SocialPostStatus } from "@/types"
import {
    cancelPostAction,
    schedulePostAction,
    searchContactsAction,
    uploadSocialMediaAction,
} from "./actions"

interface ContactResult {
    id: string
    name: string
    email: string
    phone: string
}

interface Props {
    posts: SocialPost[]
    canSchedule: boolean
    connectedAccounts: SocialAccount[]
}

const ALL_PLATFORMS: SocialPlatform[] = [
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "tiktok",
    "pinterest",
    "youtube",
    "threads",
]

function statusLabel(status: SocialPostStatus): { label: string; className: string } {
    const map: Record<SocialPostStatus, { label: string; className: string }> = {
        draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
        scheduled: { label: "Scheduled", className: "bg-blue-500/10 text-blue-600" },
        publishing: { label: "Publishing…", className: "bg-amber-500/10 text-amber-600" },
        published: { label: "Published", className: "bg-emerald-500/10 text-emerald-600" },
        failed: { label: "Failed", className: "bg-red-500/10 text-red-600" },
        canceled: { label: "Canceled", className: "bg-muted text-muted-foreground" },
    }
    return map[status] ?? { label: status, className: "bg-muted" }
}

function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
}
function addMonths(d: Date, n: number) {
    return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
function sameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

function Composer({
    availablePlatforms,
    canSchedule,
    onScheduled,
}: {
    availablePlatforms: SocialPlatform[]
    canSchedule: boolean
    onScheduled: (post: SocialPost) => void
}) {
    const [isPending, startTransition] = useTransition()
    const [isUploading, setIsUploading] = useState(false)
    const [content, setContent] = useState("")
    const [mediaUrl, setMediaUrl] = useState("")
    const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
        availablePlatforms.length > 0 ? [availablePlatforms[0]] : [],
    )
    const [scheduledAt, setScheduledAt] = useState("")
    const [postNow, setPostNow] = useState(false)

    const [contact, setContact] = useState<ContactResult | null>(null)
    const [contactQuery, setContactQuery] = useState("")
    const [contactResults, setContactResults] = useState<ContactResult[]>([])
    const [contactOpen, setContactOpen] = useState(false)
    const contactSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const togglePlatform = (p: SocialPlatform) => {
        setSelectedPlatforms((prev) =>
            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
        )
    }

    const handleContactQueryChange = (value: string) => {
        setContactQuery(value)
        setContactOpen(true)
        if (contactSearchTimer.current) clearTimeout(contactSearchTimer.current)
        contactSearchTimer.current = setTimeout(async () => {
            const res = await searchContactsAction({ query: value, limit: 10 })
            if (res.success) setContactResults(res.contacts)
        }, 180)
    }

    const handlePickContact = (c: ContactResult) => {
        setContact(c)
        setContactOpen(false)
        setContactQuery("")
    }

    const handleFile = (file: File) => {
        setIsUploading(true)
        const formData = new FormData()
        formData.append("file", file)
        uploadSocialMediaAction(formData)
            .then((res) => {
                if (!res.success || !res.url) {
                    toast.error(res.error || "Upload failed")
                    return
                }
                setMediaUrl(res.url)
                toast.success("Media uploaded")
            })
            .catch((err) => {
                toast.error(err instanceof Error ? err.message : "Upload failed")
            })
            .finally(() => {
                setIsUploading(false)
            })
    }

    const handleSubmit = () => {
        if (!content.trim()) {
            toast.error("Write some content first")
            return
        }
        if (selectedPlatforms.length === 0) {
            toast.error("Pick at least one platform")
            return
        }
        if (!postNow && !scheduledAt) {
            toast.error("Pick a schedule time or tick 'post now'")
            return
        }

        const scheduledIso = postNow ? null : new Date(scheduledAt).toISOString()

        startTransition(async () => {
            const result = await schedulePostAction({
                platforms: selectedPlatforms,
                content: content.trim(),
                mediaUrls: mediaUrl.trim() ? [mediaUrl.trim()] : [],
                scheduledAt: scheduledIso,
                contactId: contact?.id ?? null,
            })
            if (!result.success || !result.post) {
                toast.error(result.error || "Failed to schedule")
                return
            }
            toast.success(postNow ? "Post queued for publishing" : "Post scheduled")
            onScheduled(result.post)
            setContent("")
            setMediaUrl("")
            setScheduledAt("")
            setPostNow(false)
            setContact(null)
        })
    }

    const platformOptions = availablePlatforms.length > 0 ? availablePlatforms : ALL_PLATFORMS

    return (
        <Card>
            <CardHeader>
                <CardTitle>Compose</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <textarea
                        id="content"
                        className="w-full min-h-[120px] p-3 border rounded-md bg-background text-sm"
                        placeholder="What do you want to post?"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        disabled={isPending || !canSchedule}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Media (optional)</Label>
                    {mediaUrl ? (
                        <div className="flex items-center gap-2 p-2 border rounded-md">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={mediaUrl}
                                alt="Preview"
                                className="w-14 h-14 object-cover rounded"
                            />
                            <div className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                                {mediaUrl}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setMediaUrl("")}
                                disabled={isPending || isUploading}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) handleFile(f)
                                    e.target.value = ""
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isPending || isUploading || !canSchedule}
                            >
                                {isUploading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4 mr-2" />
                                )}
                                Upload image or video
                            </Button>
                            <span className="text-xs text-muted-foreground">or</span>
                            <Input
                                placeholder="paste a URL"
                                value={mediaUrl}
                                onChange={(e) => setMediaUrl(e.target.value)}
                                disabled={isPending || !canSchedule}
                                className="flex-1"
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-2 relative">
                    <Label>Attach to contact (optional)</Label>
                    {contact ? (
                        <div className="flex items-center gap-2 p-2 border rounded-md">
                            <User className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{contact.name || contact.email}</div>
                                {contact.email && contact.name && (
                                    <div className="text-xs text-muted-foreground truncate">
                                        {contact.email}
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setContact(null)}
                                disabled={isPending}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Input
                                placeholder="Search contacts…"
                                value={contactQuery}
                                onChange={(e) => handleContactQueryChange(e.target.value)}
                                onFocus={() => handleContactQueryChange(contactQuery)}
                                onBlur={() =>
                                    setTimeout(() => setContactOpen(false), 150)
                                }
                                disabled={isPending || !canSchedule}
                            />
                            {contactOpen && contactResults.length > 0 && (
                                <div className="absolute z-10 left-0 right-0 mt-1 border rounded-md bg-popover shadow-md max-h-60 overflow-auto">
                                    {contactResults.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                handlePickContact(c)
                                            }}
                                        >
                                            <div className="truncate">{c.name || c.email}</div>
                                            {c.name && c.email && (
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {c.email}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                        Linking a contact adds this post to their timeline feed.
                    </p>
                </div>
                <div className="space-y-2">
                    <Label>Platforms</Label>
                    <div className="flex flex-wrap gap-2">
                        {platformOptions.map((p) => (
                            <button
                                key={p}
                                type="button"
                                disabled={isPending || !canSchedule}
                                onClick={() => togglePlatform(p)}
                                className={`px-3 py-1.5 rounded-md border text-xs capitalize transition-colors ${
                                    selectedPlatforms.includes(p)
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background hover:bg-muted"
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    {availablePlatforms.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                            No platforms detected from your connection yet. Pick anyway — Zernio will
                            route to whatever is connected.
                        </p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="scheduledAt">When</Label>
                    <div className="flex items-center gap-3">
                        <Input
                            id="scheduledAt"
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            disabled={isPending || postNow || !canSchedule}
                        />
                        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                            <Checkbox
                                checked={postNow}
                                onCheckedChange={(v) => setPostNow(!!v)}
                                disabled={isPending || !canSchedule}
                            />
                            Post now
                        </label>
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={isPending || !canSchedule}>
                        {isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4 mr-2" />
                        )}
                        {postNow ? "Publish" : "Schedule"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function CalendarView({
    posts,
    onSelectDay,
    selectedDay,
}: {
    posts: SocialPost[]
    onSelectDay: (d: Date | null) => void
    selectedDay: Date | null
}) {
    const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))

    const postsByDay = useMemo(() => {
        const map = new Map<string, SocialPost[]>()
        for (const p of posts) {
            if (!p.scheduledAt) continue
            const d = new Date(p.scheduledAt)
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
            const arr = map.get(key) ?? []
            arr.push(p)
            map.set(key, arr)
        }
        return map
    }, [posts])

    // Build 6-row grid
    const firstDayOfMonth = new Date(viewMonth)
    const offset = firstDayOfMonth.getDay() // 0 = Sun
    const gridStart = new Date(firstDayOfMonth)
    gridStart.setDate(gridStart.getDate() - offset)

    const days: Date[] = []
    for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart)
        d.setDate(d.getDate() + i)
        days.push(d)
    }

    const monthLabel = viewMonth.toLocaleString(undefined, {
        month: "long",
        year: "numeric",
    })

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">{monthLabel}</CardTitle>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewMonth((m) => addMonths(m, -1))}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewMonth(startOfMonth(new Date()))}
                    >
                        <CalendarIcon className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewMonth((m) => addMonths(m, 1))}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                        <div key={d} className="text-center py-1">
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((d) => {
                        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
                        const dayPosts = postsByDay.get(key) ?? []
                        const isCurrentMonth = d.getMonth() === viewMonth.getMonth()
                        const isToday = sameDay(d, new Date())
                        const isSelected = selectedDay && sameDay(d, selectedDay)
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() =>
                                    onSelectDay(selectedDay && sameDay(d, selectedDay) ? null : d)
                                }
                                className={`min-h-[64px] p-1.5 border rounded text-left transition-colors ${
                                    isCurrentMonth
                                        ? "bg-background"
                                        : "bg-muted/30 text-muted-foreground"
                                } ${isSelected ? "ring-2 ring-primary" : ""} ${
                                    isToday ? "border-primary" : ""
                                } hover:bg-muted/50`}
                            >
                                <div className="text-xs tabular-nums">{d.getDate()}</div>
                                <div className="flex flex-wrap gap-0.5 mt-1">
                                    {dayPosts.slice(0, 3).map((p) => {
                                        const { className } = statusLabel(p.status)
                                        return (
                                            <span
                                                key={p.id}
                                                className={`inline-block w-1.5 h-1.5 rounded-full ${className}`}
                                                title={p.content.slice(0, 40)}
                                            />
                                        )
                                    })}
                                    {dayPosts.length > 3 && (
                                        <span className="text-[10px] text-muted-foreground">
                                            +{dayPosts.length - 3}
                                        </span>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}

function PostRow({
    post,
    onCanceled,
}: {
    post: SocialPost
    onCanceled: (id: string) => void
}) {
    const [isPending, startTransition] = useTransition()
    const status = statusLabel(post.status)

    const canCancel = post.status === "scheduled" || post.status === "draft"

    const handleCancel = () => {
        if (!confirm("Cancel this scheduled post?")) return
        startTransition(async () => {
            const result = await cancelPostAction(post.id)
            if (!result.success) {
                toast.error(result.error || "Cancel failed")
                return
            }
            toast.success("Canceled")
            onCanceled(post.id)
        })
    }

    return (
        <div className="flex items-start gap-3 py-3 border-b last:border-0">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={status.className}>{status.label}</Badge>
                    {post.platforms.map((p) => (
                        <span
                            key={p}
                            className="text-[10px] uppercase tracking-wide text-muted-foreground"
                        >
                            {p}
                        </span>
                    ))}
                </div>
                <div className="text-sm mt-1 break-words whitespace-pre-line line-clamp-3">
                    {post.content}
                </div>
                {post.errorMessage && (
                    <div className="text-xs text-red-600 mt-1">{post.errorMessage}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                    {post.scheduledAt
                        ? new Date(post.scheduledAt).toLocaleString()
                        : "(no schedule)"}
                    {post.publishedAt && (
                        <> • published {new Date(post.publishedAt).toLocaleString()}</>
                    )}
                </div>
            </div>
            {canCancel && (
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={handleCancel}
                    title="Cancel"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            )}
        </div>
    )
}

export function SocialPlanner({ posts, canSchedule, connectedAccounts }: Props) {
    const [localPosts, setLocalPosts] = useState(posts)
    const [view, setView] = useState<"calendar" | "list">("calendar")
    const [selectedDay, setSelectedDay] = useState<Date | null>(null)

    const availablePlatforms = useMemo(() => {
        const set = new Set<SocialPlatform>()
        for (const a of connectedAccounts) set.add(a.platform)
        return Array.from(set)
    }, [connectedAccounts])

    const displayPosts = useMemo(() => {
        if (!selectedDay) return localPosts
        return localPosts.filter((p) => {
            if (!p.scheduledAt) return false
            return sameDay(new Date(p.scheduledAt), selectedDay)
        })
    }, [localPosts, selectedDay])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-2">
                    <Button
                        variant={view === "calendar" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setView("calendar")}
                    >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        Calendar
                    </Button>
                    <Button
                        variant={view === "list" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setView("list")}
                    >
                        <List className="w-4 h-4 mr-2" />
                        List
                    </Button>
                    {selectedDay && (
                        <span className="text-xs text-muted-foreground ml-2">
                            Showing {selectedDay.toDateString()}{" "}
                            <button
                                className="underline ml-1"
                                onClick={() => setSelectedDay(null)}
                                type="button"
                            >
                                clear
                            </button>
                        </span>
                    )}
                </div>

                {view === "calendar" && (
                    <CalendarView
                        posts={localPosts}
                        onSelectDay={setSelectedDay}
                        selectedDay={selectedDay}
                    />
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            {selectedDay ? "Posts on this day" : "All posts"}
                            <span className="text-xs text-muted-foreground font-normal ml-2">
                                ({displayPosts.length})
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y">
                        {displayPosts.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                                Nothing scheduled {selectedDay ? "for this day" : "yet"}.
                            </p>
                        ) : (
                            displayPosts.map((p) => (
                                <PostRow
                                    key={p.id}
                                    post={p}
                                    onCanceled={(id) =>
                                        setLocalPosts((prev) =>
                                            prev.map((x) =>
                                                x.id === id ? { ...x, status: "canceled" } : x,
                                            ),
                                        )
                                    }
                                />
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            <div>
                <Composer
                    availablePlatforms={availablePlatforms}
                    canSchedule={canSchedule}
                    onScheduled={(post) => setLocalPosts((prev) => [post, ...prev])}
                />
            </div>
        </div>
    )
}
