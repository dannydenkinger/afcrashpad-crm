"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    Send, Trash2, ChevronDown, ChevronUp, FileText, AtSign,
} from "lucide-react"

interface MentionUser {
    userId: string
    userName: string
}

interface NoteItem {
    id: string
    content: string
    authorName?: string | null
    authorId?: string | null
    mentions?: MentionUser[]
    createdAt: string
}

interface NotesEditorProps {
    notes: NoteItem[]
    onAddNote: (content: string, mentions: MentionUser[]) => Promise<void>
    onDeleteNote: (noteId: string) => void
    users: { id: string; name: string; email: string }[]
    placeholder?: string
    isLoading?: boolean
    emptyMessage?: string
}

/**
 * Renders note content with @mentions highlighted as inline badges.
 */
function NoteContent({ content, mentions }: { content: string; mentions?: MentionUser[] }) {
    if (!mentions?.length) {
        return <>{content}</>
    }

    // Build a regex that matches all @UserName patterns from the mentions list
    const mentionNames = mentions.map(m => m.userName)
    // Escape regex special chars
    const escaped = mentionNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`(@(?:${escaped.join('|')}))`, 'g')

    const parts = content.split(regex)
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('@') && mentionNames.some(name => part === `@${name}`)) {
                    return (
                        <span
                            key={i}
                            className="inline-flex items-center bg-primary/10 text-primary rounded px-1 py-0.5 text-xs font-semibold mx-0.5"
                        >
                            {part}
                        </span>
                    )
                }
                return <span key={i}>{part}</span>
            })}
        </>
    )
}

export function NotesEditor({
    notes,
    onAddNote,
    onDeleteNote,
    users,
    placeholder = "Type a note... Use @ to mention a team member",
    isLoading = false,
    emptyMessage = "No notes yet",
}: NotesEditorProps) {
    const [content, setContent] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    // Mention state
    const [showMentionDropdown, setShowMentionDropdown] = useState(false)
    const [mentionQuery, setMentionQuery] = useState("")
    const [mentionStartIndex, setMentionStartIndex] = useState(-1)
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
    const [activeMentions, setActiveMentions] = useState<MentionUser[]>([])

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(mentionQuery.toLowerCase())
    ).slice(0, 8)

    const toggleExpanded = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const insertMention = useCallback((user: { id: string; name: string }) => {
        const before = content.slice(0, mentionStartIndex)
        const after = content.slice(textareaRef.current?.selectionStart ?? content.length)
        const mentionText = `@${user.name} `
        const newContent = before + mentionText + after

        setContent(newContent)
        setActiveMentions(prev => {
            if (prev.some(m => m.userId === user.id)) return prev
            return [...prev, { userId: user.id, userName: user.name }]
        })
        setShowMentionDropdown(false)
        setMentionQuery("")
        setMentionStartIndex(-1)
        setSelectedMentionIndex(0)

        // Focus textarea after insert
        setTimeout(() => {
            if (textareaRef.current) {
                const pos = before.length + mentionText.length
                textareaRef.current.focus()
                textareaRef.current.setSelectionRange(pos, pos)
            }
        }, 0)
    }, [content, mentionStartIndex])

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value
        setContent(value)

        const cursorPos = e.target.selectionStart
        // Check if we are in a mention context (find the last @ before cursor)
        const textBeforeCursor = value.slice(0, cursorPos)
        const lastAtIndex = textBeforeCursor.lastIndexOf('@')

        if (lastAtIndex >= 0) {
            // Check the char before @ is start of string or whitespace
            const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
            if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
                const query = textBeforeCursor.slice(lastAtIndex + 1)
                // Only show if no space in query (single-word partial match) or if query is a known name
                if (!query.includes(' ') || users.some(u => u.name.toLowerCase().startsWith(query.toLowerCase()))) {
                    setMentionQuery(query)
                    setMentionStartIndex(lastAtIndex)
                    setShowMentionDropdown(true)
                    setSelectedMentionIndex(0)
                    return
                }
            }
        }
        setShowMentionDropdown(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showMentionDropdown || filteredUsers.length === 0) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedMentionIndex(prev => (prev + 1) % filteredUsers.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length)
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            insertMention(filteredUsers[selectedMentionIndex])
        } else if (e.key === 'Escape') {
            setShowMentionDropdown(false)
        }
    }

    const handleSubmit = async () => {
        if (!content.trim() || isSaving) return
        setIsSaving(true)

        // Filter mentions to only those that are still in the content
        const finalMentions = activeMentions.filter(m =>
            content.includes(`@${m.userName}`)
        )

        try {
            await onAddNote(content.trim(), finalMentions)
            setContent("")
            setActiveMentions([])
        } finally {
            setIsSaving(false)
        }
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
                setShowMentionDropdown(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div className="flex flex-col h-full">
            {/* Notes list */}
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                {isLoading ? (
                    <div className="py-8 text-sm text-muted-foreground text-center">Loading notes...</div>
                ) : notes.length > 0 ? (
                    notes.map((note) => {
                        const isExpanded = expandedIds.has(note.id)
                        const lineCount = (note.content || "").split(/\n/).length
                        const isLong = lineCount > 3 || (note.content || "").length > 200
                        const initials = note.authorName
                            ? note.authorName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                            : "OP"

                        return (
                            <div key={note.id} className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-muted/20 shadow-sm">
                                <Avatar className="h-8 w-8 shrink-0 border border-background">
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                                </Avatar>
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-foreground">
                                            {note.authorName ?? "Internal Note"}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                {new Date(note.createdAt).toLocaleDateString()}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                onClick={() => onDeleteNote(note.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <p className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line ${!isExpanded && isLong ? "line-clamp-3" : ""}`}>
                                        <NoteContent content={note.content} mentions={note.mentions} />
                                    </p>
                                    {isLong && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs text-primary px-0"
                                            onClick={() => toggleExpanded(note.id)}
                                        >
                                            {isExpanded ? <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Show less</> : <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Show more</>}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-30">
                        <FileText className="h-10 w-10" />
                        <p className="text-xs font-bold uppercase tracking-widest text-center">{emptyMessage}</p>
                    </div>
                )}
            </div>

            {/* Note input with @mention */}
            <div className="mt-6 pt-6 border-t relative group">
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        placeholder={placeholder}
                        className="w-full min-h-[100px] p-4 pr-12 rounded-xl bg-muted/30 border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all resize-none"
                        value={content}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                    />

                    {/* @ hint button */}
                    <button
                        type="button"
                        className="absolute left-4 bottom-4 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Mention a team member (@)"
                        onClick={() => {
                            // Insert @ at cursor position
                            const ta = textareaRef.current
                            if (!ta) return
                            const pos = ta.selectionStart
                            const before = content.slice(0, pos)
                            const after = content.slice(pos)
                            const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')
                            const insert = (needsSpace ? ' ' : '') + '@'
                            const newContent = before + insert + after
                            setContent(newContent)
                            const newPos = pos + insert.length
                            setTimeout(() => {
                                ta.focus()
                                ta.setSelectionRange(newPos, newPos)
                                // Trigger mention dropdown
                                setMentionStartIndex(newPos - 1)
                                setMentionQuery("")
                                setShowMentionDropdown(true)
                                setSelectedMentionIndex(0)
                            }, 0)
                        }}
                    >
                        <AtSign className="h-4 w-4" />
                    </button>

                    {/* Mention autocomplete dropdown */}
                    {showMentionDropdown && filteredUsers.length > 0 && (
                        <div
                            ref={dropdownRef}
                            className="absolute bottom-full left-0 mb-1 w-72 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg z-50"
                        >
                            {filteredUsers.map((user, index) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                                        index === selectedMentionIndex ? "bg-accent" : ""
                                    }`}
                                    onMouseDown={(e) => {
                                        e.preventDefault() // Prevent textarea blur
                                        insertMention(user)
                                    }}
                                    onMouseEnter={() => setSelectedMentionIndex(index)}
                                >
                                    <Avatar className="h-6 w-6 shrink-0">
                                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                            {user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{user.name}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <Button
                    size="sm"
                    className="absolute right-4 bottom-4 h-8 gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                    onClick={handleSubmit}
                    disabled={isSaving || !content.trim()}
                >
                    <Send className="h-3.5 w-3.5" />
                    {isSaving ? "Saving..." : "Save Note"}
                </Button>
            </div>
        </div>
    )
}
