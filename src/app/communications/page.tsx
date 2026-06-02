"use client"

import { useState, useEffect, useRef } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    Search, Send, ArrowLeft, Plus, ArrowUp, MessageSquare,
    Clock, Eye, X, FileText, Reply, CornerDownRight, Paperclip, Zap, CalendarDays,
    AlertCircle,
} from "lucide-react"
import { getConversations, getMessages, sendMessage, getAllContacts, getEmailTracking, scheduleMessage, cancelScheduledMessage } from "./actions"
import { useIsMobile } from "@/hooks/useIsMobile"
import { toast } from "sonner"
import SchedulePicker from "./SchedulePicker"
import SnippetsManager from "./SnippetsManager"
import AttachmentPicker, { type AttachmentFile } from "./AttachmentPicker"
import { WriteWithAIButton } from "@/components/ai/WriteWithAIButton"

export default function CommunicationsPage() {
    const isMobile = useIsMobile()
    const [conversations, setConversations] = useState<any[]>([])
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [contact, setContact] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingThread, setIsLoadingThread] = useState(false)
    const [threadLoadError, setThreadLoadError] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const debouncedSearch = useDebounce(search, 300)
    const [newMessage, setNewMessage] = useState("")
    const [messageType, setMessageType] = useState("email")
    const [isSending, setIsSending] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string>("all")
    const [showNewConvo, setShowNewConvo] = useState(false)
    const [allContacts, setAllContacts] = useState<any[]>([])
    const [contactSearch, setContactSearch] = useState("")
    const [trackingData, setTrackingData] = useState<any[]>([])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const [showSchedulePicker, setShowSchedulePicker] = useState(false)
    const [showSnippets, setShowSnippets] = useState(false)
    const [attachments, setAttachments] = useState<AttachmentFile[]>([])
    const [showPlusMenu, setShowPlusMenu] = useState(false)
    const [replyToMessage, setReplyToMessage] = useState<any>(null)
    const [emailSubject, setEmailSubject] = useState("")

    // Draft auto-save
    const draftKey = selectedContactId ? `comms-draft-${selectedContactId}` : null
    useEffect(() => {
        if (draftKey && newMessage) {
            const timeout = setTimeout(() => {
                localStorage.setItem(draftKey, newMessage)
            }, 500)
            return () => clearTimeout(timeout)
        }
    }, [newMessage, draftKey])

    const fetchConversations = async () => {
        setIsLoading(true)
        const res = await getConversations()
        if (res.success) setConversations(res.conversations || [])
        setIsLoading(false)
    }

    useEffect(() => { fetchConversations() }, [])

    useEffect(() => {
        const interval = setInterval(() => {
            fetchConversations()
            if (selectedContactId) {
                getMessages(selectedContactId).then(res => {
                    if (res.success) setMessages(res.messages || [])
                })
            }
        }, 30000)
        return () => clearInterval(interval)
    }, [selectedContactId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const openThread = async (contactId: string) => {
        setIsLoadingThread(true)
        setThreadLoadError(null)
        setSelectedContactId(contactId)
        setShowNewConvo(false)
        try {
            const [res, trackingRes] = await Promise.all([
                getMessages(contactId),
                getEmailTracking(contactId),
            ])
            if (res.success) {
                setMessages(res.messages || [])
                setContact(res.contact)
            } else {
                setThreadLoadError((res as { error?: string }).error || "Failed to load messages")
            }
            setTrackingData(trackingRes.success ? trackingRes.tracking : [])
        } catch (err) {
            setThreadLoadError(err instanceof Error ? err.message : "Failed to load messages")
        } finally {
            setIsLoadingThread(false)
        }
        const savedDraft = localStorage.getItem(`comms-draft-${contactId}`)
        if (savedDraft) setNewMessage(savedDraft)
        else setNewMessage("")
    }

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedContactId) return
        setIsSending(true)
        const res = await sendMessage(
            selectedContactId,
            messageType,
            newMessage.trim(),
            attachments.length > 0 ? attachments.map(a => ({ filename: a.filename, url: a.url, contentType: a.contentType })) : undefined,
            replyToMessage?.id || undefined,
            emailSubject.trim() || undefined
        )
        if (res.success) {
            setNewMessage("")
            setEmailSubject("")
            if (draftKey) localStorage.removeItem(draftKey)
            setAttachments([])
            setReplyToMessage(null)
            const threadRes = await getMessages(selectedContactId)
            if (threadRes.success) setMessages(threadRes.messages || [])
            fetchConversations()
        } else {
            toast.error((res as { error?: string }).error || "Failed to send message — your draft is preserved")
        }
        setIsSending(false)
    }

    const handleSchedule = async (scheduledAt: string) => {
        if (!newMessage.trim() || !selectedContactId) return
        setIsSending(true)
        const res = await scheduleMessage(
            selectedContactId,
            messageType,
            newMessage.trim(),
            scheduledAt,
            attachments.length > 0 ? attachments.map(a => ({ filename: a.filename, url: a.url, contentType: a.contentType })) : undefined
        )
        if (res.success) {
            const when = new Date(scheduledAt)
            const sameDay = when.toDateString() === new Date().toDateString()
            const formatted = sameDay
                ? `today at ${when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                : when.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
            toast.success(`Scheduled for ${formatted}`)
            setNewMessage("")
            if (draftKey) localStorage.removeItem(draftKey)
            setAttachments([])
            setShowSchedulePicker(false)
            const threadRes = await getMessages(selectedContactId)
            if (threadRes.success) setMessages(threadRes.messages || [])
            fetchConversations()
        } else {
            toast.error(res.error || "Failed to schedule message")
        }
        setIsSending(false)
    }

    const handleCancelScheduled = async (messageId: string) => {
        if (!selectedContactId) return
        const res = await cancelScheduledMessage(selectedContactId, messageId)
        if (res.success) {
            toast.success("Scheduled message cancelled")
            const threadRes = await getMessages(selectedContactId)
            if (threadRes.success) setMessages(threadRes.messages || [])
        } else {
            toast.error(res.error || "Failed to cancel")
        }
    }

    const handleInsertSnippet = (content: string) => {
        const textarea = textareaRef.current
        if (textarea) {
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const before = newMessage.substring(0, start)
            const after = newMessage.substring(end)
            setNewMessage(before + content + after)
            setTimeout(() => {
                textarea.focus()
                textarea.setSelectionRange(start + content.length, start + content.length)
            }, 0)
        } else {
            setNewMessage(prev => prev + content)
        }
    }

    const startNewConversation = async () => {
        setShowNewConvo(true)
        setSelectedContactId(null)
        const res = await getAllContacts()
        if (res.success) setAllContacts(res.contacts || [])
    }

    const selectNewContact = (contactId: string) => {
        setShowNewConvo(false)
        openThread(contactId)
    }

    const filteredConversations = conversations.filter(c => {
        const matchesSearch = c.contactName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            c.email?.toLowerCase().includes(debouncedSearch.toLowerCase())
        const matchesType = typeFilter === "all" || c.lastMessageType === typeFilter
        return matchesSearch && matchesType
    })

    const filteredContacts = allContacts.filter(c =>
        c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(contactSearch.toLowerCase())
    )

    // ── Helpers ──────────────────────────────────────────────────────

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - d.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m`
        if (diffHours < 24) return `${diffHours}h`
        if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const formatDateSeparator = (dateStr: string) => {
        const d = new Date(dateStr)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000)

        if (diffDays === 0) return "Today"
        if (diffDays === 1) return "Yesterday"
        if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    }

    const formatBubbleTime = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }

    const shouldShowDateSeparator = (msg: any, idx: number, msgs: any[]) => {
        if (idx === 0) return true
        const prev = new Date(msgs[idx - 1].createdAt)
        const curr = new Date(msg.createdAt)
        return prev.toDateString() !== curr.toDateString()
    }

    const isConsecutive = (msg: any, idx: number, msgs: any[]) => {
        if (idx === 0) return false
        const prev = msgs[idx - 1]
        const sameDirection = (prev.direction === msg.direction)
        const timeDiff = Math.abs(new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime())
        return sameDirection && timeDiff < 120000 // 2 minutes
    }

    const isLastInGroup = (msg: any, idx: number, msgs: any[]) => {
        if (idx === msgs.length - 1) return true
        const next = msgs[idx + 1]
        const sameDirection = (next.direction === msg.direction)
        const timeDiff = Math.abs(new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime())
        return !sameDirection || timeDiff >= 120000
    }

    const getTrackingStatus = (msg: any) => {
        if (msg.type !== "email") return null
        const tracking = trackingData.find((t: any) => {
            if (msg.trackingId && t.id === msg.trackingId) return true
            const msgTime = new Date(msg.createdAt).getTime()
            const trackTime = new Date(t.sentAt).getTime()
            return Math.abs(msgTime - trackTime) < 60000
        })
        if (!tracking) return "Sent"
        if (tracking.opened) return `Opened${tracking.openCount > 1 ? ` ${tracking.openCount}x` : ""}`
        return "Delivered"
    }

    // ── Conversation List Component ─────────────────────────────────

    const ConversationList = ({ className = "" }: { className?: string }) => (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Messages
                        </h1>
                        {conversations.length > 0 && (
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded tabular-nums">
                                {conversations.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={startNewConversation}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                        title="New conversation"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 rounded-lg bg-muted border-0 text-sm"
                    />
                </div>
                {/* Filter tabs */}
                <div className="flex items-center gap-1 mt-2 bg-muted rounded-lg p-0.5">
                    {[
                        { value: "all", label: "All" },
                        { value: "email", label: "Email" },
                        { value: "text", label: "Text" },
                    ].map(f => (
                        <button
                            key={f.value}
                            onClick={() => setTypeFilter(f.value)}
                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                typeFilter === f.value
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* New Conversation Picker */}
            {showNewConvo && (
                <div className="px-4 py-2 border-b">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-primary">To:</span>
                        <button onClick={() => setShowNewConvo(false)} className="text-xs text-muted-foreground">Cancel</button>
                    </div>
                    <Input
                        placeholder="Search contacts..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        className="h-8 text-sm mb-2"
                        autoFocus
                    />
                    <div className="max-h-40 overflow-y-auto">
                        {filteredContacts.map(c => (
                            <button
                                key={c.id}
                                onClick={() => selectNewContact(c.id)}
                                className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs">{c.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{c.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                        <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground mb-3">No conversations yet</p>
                        <Button size="sm" onClick={startNewConversation} className="rounded-full">
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            New Message
                        </Button>
                    </div>
                ) : filteredConversations.map(convo => {
                    const needsAttention = convo.lastMessageDirection === "inbound" && selectedContactId !== convo.contactId
                    const isSelected = selectedContactId === convo.contactId
                    return (
                        <button
                            key={convo.contactId}
                            onClick={() => openThread(convo.contactId)}
                            className={`flex items-center gap-3 w-full px-4 py-3 transition-colors text-left ${
                                isSelected ? "bg-primary/10" : "hover:bg-muted/50 active:bg-muted"
                            }`}
                        >
                            <div className="relative shrink-0">
                                {needsAttention && (
                                    <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-blue-500" />
                                )}
                                <Avatar className="h-12 w-12">
                                    <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-500 text-white text-sm font-medium">
                                        {convo.contactName?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm truncate ${needsAttention ? "font-bold" : "font-semibold"}`}>
                                        {convo.contactName}
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                        {formatTime(convo.lastMessageTime)}
                                    </span>
                                </div>
                                <p className={`text-sm truncate mt-0.5 ${needsAttention ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                    {convo.lastMessage}
                                </p>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )

    // ── Message Thread Component ────────────────────────────────────

    const MessageThread = () => {
        if (!selectedContactId) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                        <MessageSquare className="h-8 w-8 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">Select a conversation</p>
                    <p className="text-xs">Choose from the list or start a new one</p>
                </div>
            )
        }

        if (isLoadingThread) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )
        }

        if (threadLoadError) {
            return (
                <div className="flex-1 flex items-center justify-center px-6">
                    <div className="max-w-sm text-center space-y-3">
                        <div className="mx-auto h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold">Couldn&apos;t load this conversation</h3>
                            <p className="text-xs text-muted-foreground mt-1">{threadLoadError}</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedContactId && openThread(selectedContactId)}
                        >
                            Try again
                        </Button>
                    </div>
                </div>
            )
        }

        const lastOutboundIdx = [...messages].reverse().findIndex(m =>
            (m.direction === "outbound" || m.direction === "OUTBOUND") && m.status !== "scheduled" && m.status !== "cancelled"
        )
        const lastOutboundId = lastOutboundIdx >= 0 ? messages[messages.length - 1 - lastOutboundIdx]?.id : null

        return (
            <div className="flex-1 flex flex-col min-h-0">
                {/* Thread Header */}
                <div className="px-4 py-3 border-b flex items-center shrink-0">
                    <button
                        className="sm:hidden p-1 mr-2 -ml-1 rounded-lg hover:bg-muted"
                        onClick={() => setSelectedContactId(null)}
                    >
                        <ArrowLeft className="h-5 w-5 text-primary" />
                    </button>
                    <div className="flex-1 text-center sm:text-left">
                        <h3 className="text-sm font-semibold">{contact?.name}</h3>
                        <p className="text-xs text-muted-foreground">
                            {contact?.email}{contact?.phone ? ` · ${contact.phone}` : ""}
                        </p>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">No messages yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Send a message to start the conversation</p>
                        </div>
                    ) : messages.map((msg: any, idx: number) => {
                        const isOutbound = msg.direction === "outbound" || msg.direction === "OUTBOUND"
                        const isScheduled = msg.status === "scheduled"
                        const isCancelled = msg.status === "cancelled"
                        const consecutive = isConsecutive(msg, idx, messages)
                        const lastInGroup = isLastInGroup(msg, idx, messages)
                        const showDate = shouldShowDateSeparator(msg, idx, messages)
                        const isLastOutbound = msg.id === lastOutboundId

                        return (
                            <div key={msg.id}>
                                {/* Date separator */}
                                {showDate && (
                                    <div className="flex items-center justify-center my-4">
                                        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                                            {formatDateSeparator(msg.createdAt)}
                                        </span>
                                    </div>
                                )}

                                {/* Message bubble */}
                                <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} ${consecutive ? "mt-0.5" : "mt-3"} ${msg.parentMessageId ? "ml-8" : ""}`}>
                                    {msg.parentMessageId && (
                                        <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/30 mr-1 mt-2 shrink-0" />
                                    )}
                                    <div className="max-w-[80%] sm:max-w-[65%]">
                                        <div className={`px-3.5 py-2 group ${
                                            isCancelled
                                                ? "bg-muted/50 opacity-50 rounded-2xl"
                                                : isScheduled
                                                ? "bg-amber-500/10 border border-amber-500/20 rounded-2xl"
                                                : isOutbound
                                                ? `bg-primary text-primary-foreground ${lastInGroup ? "rounded-2xl rounded-br-sm" : "rounded-2xl"}`
                                                : `bg-muted ${lastInGroup ? "rounded-2xl rounded-bl-sm" : "rounded-2xl"}`
                                        }`}>
                                            {/* Scheduled indicator */}
                                            {isScheduled && msg.scheduledAt && (
                                                <div className="flex items-center gap-1 mb-1">
                                                    <CalendarDays className="h-3 w-3 text-amber-600" />
                                                    <span className="text-xs text-amber-600 font-medium">
                                                        Scheduled · {new Date(msg.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Subject */}
                                            {msg.subject && (
                                                <p className={`text-xs font-semibold ${
                                                    isOutbound && !isScheduled && !isCancelled ? "text-primary-foreground/80" : "text-foreground/70"
                                                }`}>
                                                    {msg.subject}
                                                </p>
                                            )}

                                            {/* Content */}
                                            <p className={`text-sm leading-relaxed ${isCancelled ? "line-through" : ""}`}>
                                                {msg.content}
                                            </p>

                                            {/* Attachments */}
                                            {msg.attachments?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {msg.attachments.map((att: any, i: number) => (
                                                        <a
                                                            key={i}
                                                            href={att.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs ${
                                                                isOutbound && !isScheduled && !isCancelled
                                                                    ? "bg-primary-foreground/10 text-primary-foreground/80 hover:text-primary-foreground"
                                                                    : "bg-background/50 text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            <FileText className="h-3 w-3" />
                                                            {att.filename}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer: time, tracking, actions */}
                                        {lastInGroup && (
                                            <div className={`flex items-center gap-2 mt-1 px-1 ${isOutbound ? "justify-end" : "justify-start"}`}>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {formatBubbleTime(msg.createdAt)}
                                                </span>

                                                {/* Tracking status on last outbound message */}
                                                {isLastOutbound && isOutbound && !isScheduled && !isCancelled && (
                                                    <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                                        {getTrackingStatus(msg) === "Sent" && "Sent"}
                                                        {getTrackingStatus(msg) === "Delivered" && "Delivered"}
                                                        {getTrackingStatus(msg)?.startsWith("Opened") && (
                                                            <><Eye className="h-3 w-3 inline" /> {getTrackingStatus(msg)}</>
                                                        )}
                                                    </span>
                                                )}

                                                {/* Cancel for scheduled */}
                                                {isScheduled && (
                                                    <button onClick={() => handleCancelScheduled(msg.id)} className="text-[11px] text-amber-600 hover:text-red-500 font-medium">
                                                        Cancel
                                                    </button>
                                                )}

                                                {/* Reply */}
                                                {!isScheduled && !isCancelled && (
                                                    <button
                                                        onClick={() => {
                                                            setReplyToMessage(msg)
                                                            if (msg.subject) {
                                                                setEmailSubject(msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`)
                                                            }
                                                            textareaRef.current?.focus()
                                                        }}
                                                        className="text-[11px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                                                    >
                                                        <Reply className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Compose */}
                <div className="px-3 py-2 pb-4 sm:pb-3 border-t bg-background shrink-0">
                    {/* Reply indicator */}
                    {replyToMessage && (
                        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-muted text-xs">
                            <Reply className="h-3 w-3 text-muted-foreground shrink-0" />
                            <p className="text-muted-foreground truncate flex-1">
                                {replyToMessage.content?.substring(0, 60)}
                            </p>
                            <button onClick={() => setReplyToMessage(null)}>
                                <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                        </div>
                    )}

                    {/* Popovers */}
                    {showSchedulePicker && (
                        <div className="mb-2">
                            <SchedulePicker
                                onSchedule={handleSchedule}
                                onClose={() => setShowSchedulePicker(false)}
                                isSending={isSending}
                            />
                        </div>
                    )}
                    {showSnippets && (
                        <div className="mb-2">
                            <SnippetsManager
                                onInsert={handleInsertSnippet}
                                onClose={() => setShowSnippets(false)}
                            />
                        </div>
                    )}

                    {/* Attachment chips */}
                    {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2 px-1">
                            {attachments.map((att, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs">
                                    <FileText className="h-3 w-3 text-muted-foreground" />
                                    <span className="truncate max-w-[120px]">{att.filename}</span>
                                    <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>
                                        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Send as toggle */}
                    <div className="flex items-center gap-1 mb-2 bg-muted rounded-lg p-0.5 w-fit">
                        {[
                            { value: "email", label: "Email" },
                            { value: "text", label: "Text" },
                        ].map(t => (
                            <button
                                key={t.value}
                                onClick={() => setMessageType(t.value)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                    messageType === t.value
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Subject field (email only) */}
                    {messageType === "email" && (
                        <div className="flex items-center gap-1.5 mb-2">
                            <Input
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                placeholder="Subject"
                                className="h-8 text-sm bg-muted border-0 rounded-lg flex-1"
                            />
                            <WriteWithAIButton
                                feature="subject_line"
                                contactId={selectedContactId || undefined}
                                onAccept={(text) => setEmailSubject(text)}
                                variant="icon"
                            />
                        </div>
                    )}

                    {/* Compose bar */}
                    <div className="flex items-end gap-2">
                        {/* Plus menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowPlusMenu(!showPlusMenu)}
                                className={`h-9 w-9 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                                    showPlusMenu ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Plus className={`h-5 w-5 transition-transform ${showPlusMenu ? "rotate-45" : ""}`} />
                            </button>
                            {showPlusMenu && (
                                <div className="absolute bottom-12 left-0 bg-popover border rounded-xl shadow-lg p-1.5 min-w-[160px] z-10">
                                    <AttachmentPicker
                                        contactId={selectedContactId}
                                        attachments={attachments}
                                        onAdd={(att) => { setAttachments(prev => [...prev, att]); setShowPlusMenu(false) }}
                                        onRemove={(idx) => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                    />
                                    <button
                                        onClick={() => { setShowSnippets(true); setShowPlusMenu(false) }}
                                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm text-left"
                                    >
                                        <Zap className="h-4 w-4 text-amber-500" />
                                        Snippets
                                    </button>
                                    <button
                                        onClick={() => { setShowSchedulePicker(true); setShowPlusMenu(false) }}
                                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm text-left"
                                    >
                                        <Clock className="h-4 w-4 text-blue-500" />
                                        Schedule
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Write-with-AI button */}
                        <WriteWithAIButton
                            feature={messageType === "text" ? "inline_sms_writer" : "inline_email_writer"}
                            contactId={selectedContactId || undefined}
                            existing={newMessage || undefined}
                            onAccept={(text) => {
                                setNewMessage(text)
                                // Refocus the textarea so the user can edit immediately
                                setTimeout(() => textareaRef.current?.focus(), 50)
                            }}
                            variant="icon"
                        />

                        {/* Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSend()
                                }
                            }}
                            placeholder="Message"
                            rows={1}
                            className="flex-1 min-w-0 resize-none rounded-2xl bg-muted border-0 px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] max-h-[120px]"
                        />

                        {/* Send button */}
                        {newMessage.trim() && (
                            <button
                                onClick={handleSend}
                                disabled={isSending}
                                className="h-9 w-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0 disabled:opacity-50"
                            >
                                <ArrowUp className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ── Layout ──────────────────────────────────────────────────────

    if (isMobile) {
        if (selectedContactId) {
            return <div className="flex flex-col h-full bg-background"><MessageThread /></div>
        }
        if (showNewConvo) {
            return (
                <div className="flex flex-col h-full bg-background">
                    <div className="px-4 py-3 border-b flex items-center gap-3">
                        <button onClick={() => setShowNewConvo(false)} className="p-1 rounded-lg hover:bg-muted">
                            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <span className="text-sm font-semibold">New Message</span>
                    </div>
                    <div className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search contacts..."
                                value={contactSearch}
                                onChange={(e) => setContactSearch(e.target.value)}
                                className="pl-9 h-10 rounded-lg"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filteredContacts.map(c => (
                            <button
                                key={c.id}
                                onClick={() => selectNewContact(c.id)}
                                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted transition-colors"
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs">{c.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="text-left min-w-0">
                                    <p className="text-sm font-medium truncate">{c.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )
        }
        return <div className="flex flex-col h-full bg-background"><ConversationList /></div>
    }

    // Desktop: two-panel layout
    return (
        <div className="flex-1 flex h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] min-h-0">
            <div className={`w-[360px] border-r shrink-0 ${selectedContactId ? 'hidden sm:flex sm:flex-col' : 'flex flex-col'}`}>
                <ConversationList />
            </div>
            <div className="flex-1 flex flex-col min-w-0">
                <MessageThread />
            </div>
        </div>
    )
}
