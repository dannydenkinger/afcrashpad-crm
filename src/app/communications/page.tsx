"use client"

import { useState, useEffect, useRef } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
    Search, Send, Mail, MessageSquare, Phone, Filter,
    ArrowLeft, Plus, User, Clock, ChevronDown, Eye, MousePointerClick,
    Zap, Paperclip, BarChart3, CalendarDays, X, FileText, Reply, CornerDownRight,
    Bold, Italic, Link2, List, Trash2
} from "lucide-react"
import { getConversations, getMessages, sendMessage, getAllContacts, getEmailTracking, scheduleMessage, cancelScheduledMessage, deleteMessage, deleteConversation } from "./actions"
import { useIsMobile } from "@/hooks/useIsMobile"
import { toast } from "sonner"
import SchedulePicker from "./SchedulePicker"
import SnippetsManager from "./SnippetsManager"
import AttachmentPicker, { type AttachmentFile } from "./AttachmentPicker"
import AnalyticsPanel from "./AnalyticsPanel"

export default function CommunicationsPage() {
    const isMobile = useIsMobile()
    const [conversations, setConversations] = useState<any[]>([])
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [contact, setContact] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingThread, setIsLoadingThread] = useState(false)
    const [search, setSearch] = useState("")
    const debouncedSearch = useDebounce(search, 300)
    const [newMessage, setNewMessage] = useState("")
    const [messageType, setMessageType] = useState("email")
    const [isSending, setIsSending] = useState(false)
    const [typeFilter, setTypeFilterRaw] = useState<string>("all")
    const setTypeFilter = (value: string) => {
        setTypeFilterRaw(value)
        // Re-filter the open thread when changing channel filter
        if (selectedContactId) {
            const channel = value === "all" ? undefined : value as "email" | "sms"
            getMessages(selectedContactId, channel).then(res => {
                if (res.success) setMessages(res.messages || [])
            })
        }
    }
    const [showNewConvo, setShowNewConvo] = useState(false)
    const [allContacts, setAllContacts] = useState<any[]>([])
    const [contactSearch, setContactSearch] = useState("")
    const [trackingData, setTrackingData] = useState<any[]>([])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // New state for features
    const [showSchedulePicker, setShowSchedulePicker] = useState(false)
    const [showSnippets, setShowSnippets] = useState(false)
    const [attachments, setAttachments] = useState<AttachmentFile[]>([])
    const [showAnalytics, setShowAnalytics] = useState(false)
    const [threadSearch, setThreadSearch] = useState("")
    const [replyToMessage, setReplyToMessage] = useState<any>(null)

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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const openThread = async (contactId: string, channel?: string) => {
        setIsLoadingThread(true)
        setSelectedContactId(contactId)
        setShowNewConvo(false)
        setShowAnalytics(false)
        const filterChannel = (channel || typeFilter) as "all" | "email" | "sms" | undefined
        const [res, trackingRes] = await Promise.all([
            getMessages(contactId, filterChannel === "all" ? undefined : filterChannel),
            getEmailTracking(contactId),
        ])
        if (res.success) {
            setMessages(res.messages || [])
            setContact(res.contact)
        }
        setTrackingData(trackingRes.success ? trackingRes.tracking : [])
        setIsLoadingThread(false)
        setThreadSearch("")
        // Restore draft
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
            replyToMessage?.id || undefined
        )
        if (res.success) {
            toast.success("Message sent")
            setNewMessage("")
            if (draftKey) localStorage.removeItem(draftKey)
            setAttachments([])
            setReplyToMessage(null)
            // Refresh thread
            const threadRes = await getMessages(selectedContactId)
            if (threadRes.success) setMessages(threadRes.messages || [])
            fetchConversations()
        } else {
            toast.error("Failed to send message")
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
            toast.success("Message scheduled")
            setNewMessage("")
            if (draftKey) localStorage.removeItem(draftKey)
            setAttachments([])
            setShowSchedulePicker(false)
            // Refresh thread
            const threadRes = await getMessages(selectedContactId)
            if (threadRes.success) setMessages(threadRes.messages || [])
            fetchConversations()
        } else {
            toast.error(res.error || "Failed to schedule message")
        }
        setIsSending(false)
    }

    const handleDeleteConversation = async (contactId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const res = await deleteConversation(contactId)
        if (res.success) {
            toast.success("Conversation deleted")
            setConversations(prev => prev.filter(c => c.contactId !== contactId))
            if (selectedContactId === contactId) {
                setSelectedContactId(null)
                setMessages([])
                setContact(null)
            }
        } else {
            toast.error(res.error || "Failed to delete conversation")
        }
    }

    const handleDeleteMessage = async (messageId: string) => {
        if (!selectedContactId) return
        const res = await deleteMessage(selectedContactId, messageId)
        if (res.success) {
            toast.success("Message deleted")
            setMessages(prev => prev.filter(m => m.id !== messageId))
            fetchConversations()
        } else {
            toast.error(res.error || "Failed to delete")
        }
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
            // Focus and set cursor after inserted text
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
        setShowAnalytics(false)
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

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - d.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return d.toLocaleDateString()
    }

    const formatScheduledDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    }

    const typeIcon = (type: string) => {
        switch (type) {
            case "email": return <Mail className="h-3 w-3" />
            case "text": case "sms": return <MessageSquare className="h-3 w-3" />
            case "phone": return <Phone className="h-3 w-3" />
            default: return <MessageSquare className="h-3 w-3" />
        }
    }

    const typeColor = (type: string) => {
        switch (type) {
            case "email": return "bg-blue-500/10 text-blue-600 border-blue-500/20"
            case "text": case "sms": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            case "phone": return "bg-amber-500/10 text-amber-600 border-amber-500/20"
            default: return "bg-slate-500/10 text-slate-600 border-slate-500/20"
        }
    }

    // ─── Mobile Layout ──────────────────────────────────────────────
    if (isMobile) {
        // Thread view
        if (selectedContactId) {
            const filteredMessages = messages.filter(m => !threadSearch || m.content?.toLowerCase().includes(threadSearch.toLowerCase()))
            return (
                <div className="flex flex-col h-full bg-background">
                    {/* Thread header */}
                    <div className="px-3 py-2.5 border-b border-border flex items-center gap-3 shrink-0">
                        <button
                            className="p-1.5 rounded-lg hover:bg-muted touch-manipulation"
                            onClick={() => setSelectedContactId(null)}
                        >
                            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-muted to-muted/80 text-muted-foreground text-xs font-medium">
                                {contact?.name?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{contact?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{contact?.email}</p>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
                        {isLoadingThread ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filteredMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Send className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                <h3 className="text-lg font-medium text-foreground mb-1">No messages yet</h3>
                                <p className="text-sm text-muted-foreground max-w-sm">
                                    Send the first message to start this conversation.
                                </p>
                            </div>
                        ) : filteredMessages.map((msg: any) => {
                            const isOutbound = msg.direction === "outbound" || msg.direction === "OUTBOUND"
                            const isScheduled = msg.status === "scheduled"
                            const isCancelled = msg.status === "cancelled"
                            return (
                                <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 space-y-1 ${
                                        isCancelled ? "bg-muted/50 opacity-60" :
                                        isScheduled ? "bg-amber-500/10 border border-amber-500/20" :
                                        isOutbound ? "bg-primary text-primary-foreground rounded-br-md" :
                                        "bg-muted rounded-bl-md"
                                    }`}>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge variant="outline" className={`text-[10px] px-1 py-0 gap-0.5 border-border ${isOutbound && !isScheduled && !isCancelled ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                                {typeIcon(msg.type)}
                                                {msg.type}
                                            </Badge>
                                            {isScheduled && msg.scheduledAt && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-500">
                                                    Scheduled
                                                </Badge>
                                            )}
                                        </div>
                                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isCancelled ? "line-through" : ""}`}>{msg.content}</p>
                                        <div className="flex items-center justify-between">
                                            <p className={`text-xs ${isOutbound && !isScheduled && !isCancelled ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
                                                {formatTime(msg.createdAt)}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {isScheduled && (
                                                    <button onClick={() => handleCancelScheduled(msg.id)} className="text-xs text-amber-500 font-medium">Cancel</button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                    className={`text-xs transition-colors ${
                                                        isOutbound && !isScheduled && !isCancelled
                                                            ? "text-primary-foreground/40 hover:text-red-300"
                                                            : "text-muted-foreground/40 hover:text-red-500"
                                                    }`}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Compose */}
                    <div className="px-3 py-2.5 pb-4 border-t border-border bg-background/95 backdrop-blur-sm shrink-0">
                        {replyToMessage && (
                            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                                <Reply className="h-3 w-3 text-primary shrink-0" />
                                <p className="text-xs text-muted-foreground truncate flex-1">Replying to: {replyToMessage.content?.substring(0, 60)}</p>
                                <button onClick={() => setReplyToMessage(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 mb-2">
                            {["email", "text"].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setMessageType(t)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border touch-manipulation ${messageType === t ? `${typeColor(t)} border-current` : "text-muted-foreground border-transparent"}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={textareaRef}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder="Type your message..."
                                rows={1}
                                className="flex-1 min-w-0 resize-none rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                            />
                            <Button
                                onClick={handleSend}
                                disabled={isSending || !newMessage.trim()}
                                className="h-11 px-4 rounded-xl touch-manipulation shrink-0"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )
        }

        // New conversation picker
        if (showNewConvo) {
            return (
                <div className="flex flex-col h-full bg-background">
                    <div className="px-3 py-2.5 border-b border-border flex items-center gap-3 shrink-0">
                        <button className="p-1.5 rounded-lg hover:bg-muted touch-manipulation" onClick={() => setShowNewConvo(false)}>
                            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <span className="text-sm font-semibold text-foreground">New Conversation</span>
                    </div>
                    <div className="p-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search contacts..."
                                value={contactSearch}
                                onChange={(e) => setContactSearch(e.target.value)}
                                className="pl-9 bg-input border-border text-foreground min-h-[44px]"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto pb-28">
                        {filteredContacts.map(c => (
                            <button
                                key={c.id}
                                onClick={() => selectNewContact(c.id)}
                                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted active:bg-white/10 transition-colors touch-manipulation"
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-gradient-to-br from-muted to-muted/80 text-muted-foreground text-xs">{c.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="text-left min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )
        }

        // Conversation list
        return (
            <div className="flex flex-col h-full bg-background">
                {/* Search & filters */}
                <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search conversations..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-input border-border text-foreground min-h-[44px]"
                            />
                        </div>
                        <button
                            className="h-11 w-11 flex items-center justify-center rounded-xl bg-primary text-primary-foreground touch-manipulation"
                            onClick={startNewConversation}
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {[
                            { value: "all", label: "All" },
                            { value: "email", label: "Email" },
                            { value: "text", label: "Text" },
                        ].map(f => (
                            <button
                                key={f.value}
                                onClick={() => setTypeFilter(f.value)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors touch-manipulation ${typeFilter === f.value
                                    ? "bg-primary text-primary-foreground" : "bg-input text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto pb-28">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-1">No conversations yet</h3>
                            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                                Start a conversation with a contact to begin tracking communications.
                            </p>
                            <Button size="sm" onClick={startNewConversation}>
                                <Plus className="h-4 w-4 mr-1" />
                                Start a conversation
                            </Button>
                        </div>
                    ) : filteredConversations.map(convo => {
                        const needsAttention = convo.lastMessageDirection === "inbound"
                        return (
                            <div
                                key={convo.contactId}
                                onClick={() => openThread(convo.contactId)}
                                className="flex items-start gap-3 w-full px-4 py-3 border-b border-border hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors text-left touch-manipulation group/convo"
                            >
                                <div className="relative">
                                    <Avatar className="h-11 w-11">
                                        <AvatarFallback className="bg-gradient-to-br from-muted to-muted/80 text-muted-foreground text-sm font-medium">
                                            {convo.contactName?.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    {needsAttention && (
                                        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-blue-500 border-2 border-background" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className={`text-sm truncate ${needsAttention ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{convo.contactName}</span>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <span className="text-xs text-muted-foreground">{formatTime(convo.lastMessageTime)}</span>
                                            <button
                                                onClick={(e) => handleDeleteConversation(convo.contactId, e)}
                                                className="text-muted-foreground/40 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 border-border ${typeColor(convo.lastMessageType)}`}>
                                            {typeIcon(convo.lastMessageType)}
                                            {convo.lastMessageType}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{convo.lastMessage}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] min-h-0">
            {/* Header */}
            <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Communications</h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Track all conversations with clients and leads.</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:flex items-center gap-1.5"
                        onClick={() => { setShowAnalytics(true); setSelectedContactId(null) }}
                    >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Analytics
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row mx-0 sm:mx-4 lg:mx-8 mb-0 sm:mb-6 border-y sm:border rounded-none sm:rounded-xl overflow-hidden bg-card shadow-sm min-h-0">
                {/* Left Panel: Conversation List */}
                <div className={`w-full sm:w-[380px] border-r flex-col bg-muted/10 shrink-0 ${selectedContactId || showAnalytics ? 'hidden sm:flex' : 'flex'} min-h-0`}>
                    {/* Search + Actions */}
                    <div className="p-3 space-y-2 border-b">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search conversations..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-8 pl-8 text-sm min-h-[44px] sm:min-h-0"
                                />
                            </div>
                            <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={startNewConversation}>
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 shrink-0 sm:hidden"
                                onClick={() => { setShowAnalytics(true); setSelectedContactId(null) }}
                            >
                                <BarChart3 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        {/* Type Filter Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                                { value: "all", label: "All" },
                                { value: "email", label: "Email" },
                                { value: "text", label: "Text" },
                                ].map(f => (
                                <button
                                    key={f.value}
                                    onClick={() => setTypeFilter(f.value)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border ${typeFilter === f.value
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* New Conversation Contact Picker */}
                    {showNewConvo && (
                        <div className="border-b bg-blue-500/5 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-blue-600">New Conversation</span>
                                <button onClick={() => setShowNewConvo(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                            </div>
                            <Input
                                placeholder="Search contacts..."
                                value={contactSearch}
                                onChange={(e) => setContactSearch(e.target.value)}
                                className="h-7 text-xs"
                                autoFocus
                            />
                            <div className="max-h-32 overflow-y-auto space-y-0.5">
                                {filteredContacts.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => selectNewContact(c.id)}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                    >
                                        <Avatar className="h-6 w-6">
                                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{c.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-medium truncate">{c.name}</span>
                                            <span className="text-xs text-muted-foreground truncate">{c.email}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading...</div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <MessageSquare className="h-12 w-12 text-muted-foreground/20 mb-4" />
                                <p className="text-lg font-medium text-foreground mb-1">No conversations yet</p>
                                <p className="text-sm text-muted-foreground mb-4 max-w-sm">Start a conversation with a contact to begin tracking communications</p>
                                <Button size="sm" variant="outline" onClick={startNewConversation}>
                                    <Plus className="h-3 w-3 mr-1" /> Start a conversation
                                </Button>
                            </div>
                        ) : filteredConversations.map(convo => {
                            const needsAttention = convo.lastMessageDirection === "inbound" && selectedContactId !== convo.contactId
                            return (
                            <div
                                key={convo.contactId}
                                onClick={() => openThread(convo.contactId)}
                                className={`flex items-start gap-3 px-4 py-3 min-h-[56px] cursor-pointer transition-colors border-b border-border/30 touch-manipulation group/convo ${selectedContactId === convo.contactId
                                        ? "bg-primary/5 border-l-2 border-l-primary"
                                        : needsAttention
                                        ? "bg-blue-500/5 hover:bg-blue-500/10 active:bg-blue-500/15"
                                        : "hover:bg-muted/30 active:bg-muted/40"
                                    }`}
                            >
                                {needsAttention && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-4" />
                                )}
                                <Avatar className={`h-10 w-10 shrink-0 mt-0.5 ${needsAttention ? "-ml-1" : ""}`}>
                                    <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-foreground text-xs font-medium">
                                        {convo.contactName?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className={`text-sm truncate ${needsAttention ? "font-bold text-foreground" : "font-semibold"}`}>{convo.contactName}</span>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <span className="text-xs text-muted-foreground">{formatTime(convo.lastMessageTime)}</span>
                                            <button
                                                onClick={(e) => handleDeleteConversation(convo.contactId, e)}
                                                className="text-muted-foreground/30 hover:text-red-500 transition-colors opacity-0 group-hover/convo:opacity-100"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 ${typeColor(convo.lastMessageType)}`}>
                                            {typeIcon(convo.lastMessageType)}
                                            {convo.lastMessageType}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                            {convo.lastMessageDirection === "inbound" ? "↓ In" : "↑ Out"}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{convo.lastMessage}</p>
                                </div>
                            </div>
                        )})}
                    </div>

                    {/* Stats Footer */}
                    <div className="p-3 border-t text-xs text-muted-foreground text-center">
                        {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                        {(() => {
                            const attentionCount = conversations.filter(c => c.lastMessageDirection === "inbound").length
                            return attentionCount > 0 ? ` · ${attentionCount} need${attentionCount === 1 ? "s" : ""} attention` : ""
                        })()}
                    </div>
                </div>

                {/* Right Panel: Message Thread or Analytics */}
                <div className={`flex-1 flex-col min-w-0 ${!selectedContactId && !showAnalytics ? 'hidden sm:flex' : 'flex'}`}>
                    {showAnalytics ? (
                        <AnalyticsPanel onClose={() => setShowAnalytics(false)} />
                    ) : !selectedContactId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                                <MessageSquare className="h-8 w-8 opacity-30" />
                            </div>
                            <p className="text-sm font-medium">Select a conversation</p>
                            <p className="text-xs">Choose from the list or start a new one</p>
                        </div>
                    ) : isLoadingThread ? (
                        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading messages...</div>
                    ) : (
                        <>
                            {/* Thread Header */}
                            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8 shrink-0 -ml-2" onClick={() => setSelectedContactId(null)}>
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                                        <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-foreground text-xs sm:text-sm font-medium">
                                            {contact?.name?.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-semibold truncate">{contact?.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                                            {contact?.email && <span className="truncate">{contact.email}</span>}
                                            {contact?.phone && <><span className="hidden sm:inline">·</span><span className="truncate">{contact.phone}</span></>}
                                        </div>
                                    </div>
                                </div>
                                <Badge variant="outline" className="font-normal shrink-0 hidden sm:inline-flex">{contact?.status || "Lead"}</Badge>
                                <div className="relative hidden sm:block">
                                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search messages..."
                                        value={threadSearch}
                                        onChange={(e) => setThreadSearch(e.target.value)}
                                        className="h-7 w-40 pl-7 pr-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                    {threadSearch && (
                                        <button onClick={() => setThreadSearch("")} className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Email Tracking Summary */}
                            {trackingData.length > 0 && (
                                <div className="px-4 sm:px-6 py-2 border-b bg-muted/10 flex items-center gap-4 text-xs shrink-0 overflow-x-auto">
                                    <span className="text-muted-foreground font-medium shrink-0">Email Tracking:</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Eye className="h-3.5 w-3.5 text-emerald-500" />
                                        <span className="font-semibold">{trackingData.filter((t: any) => t.opened).length}</span>
                                        <span className="text-muted-foreground">/ {trackingData.length} opened</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <MousePointerClick className="h-3.5 w-3.5 text-blue-500" />
                                        <span className="font-semibold">{trackingData.reduce((sum: number, t: any) => sum + (t.totalClicks || 0), 0)}</span>
                                        <span className="text-muted-foreground">clicks</span>
                                    </div>
                                </div>
                            )}

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
                                {messages.length === 0 && !threadSearch ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <Send className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                        <h3 className="text-lg font-medium text-foreground mb-1">No messages yet</h3>
                                        <p className="text-sm text-muted-foreground max-w-sm">Send the first message to start this conversation.</p>
                                    </div>
                                ) : (threadSearch && messages.filter(m => m.content?.toLowerCase().includes(threadSearch.toLowerCase())).length === 0) ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                                        <Search className="h-8 w-8 opacity-20" />
                                        <p className="text-sm">No messages match &ldquo;{threadSearch}&rdquo;</p>
                                        <button onClick={() => setThreadSearch("")} className="text-xs text-primary hover:underline">Clear search</button>
                                    </div>
                                ) : messages.filter(m => !threadSearch || m.content?.toLowerCase().includes(threadSearch.toLowerCase())).map((msg: any) => {
                                    const isScheduled = msg.status === "scheduled"
                                    const isCancelled = msg.status === "cancelled"
                                    const isOutbound = msg.direction === "outbound" || msg.direction === "OUTBOUND"

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isOutbound ? "justify-end" : "justify-start"} ${msg.parentMessageId ? "ml-6 sm:ml-10" : ""}`}
                                        >
                                            {msg.parentMessageId && (
                                                <CornerDownRight className="h-4 w-4 text-muted-foreground/40 mr-1.5 mt-3 shrink-0" />
                                            )}
                                            <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 space-y-1 group ${
                                                isCancelled
                                                    ? "bg-muted/50 opacity-60 rounded-br-md"
                                                    : isScheduled
                                                    ? "bg-amber-500/10 border border-amber-500/20 rounded-br-md"
                                                    : isOutbound
                                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                                    : "bg-muted rounded-bl-md"
                                            }`}>
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <Badge variant="outline" className={`text-[10px] px-1 py-0 gap-0.5 border-border ${isOutbound && !isScheduled && !isCancelled ? "text-primary-foreground/70" : ""
                                                        }`}>
                                                        {typeIcon(msg.type)}
                                                        {msg.type}
                                                    </Badge>

                                                    {/* Thread indicator */}
                                                    {msg.parentMessageId && (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                                                            Reply
                                                        </Badge>
                                                    )}

                                                    {/* Scheduled badge */}
                                                    {isScheduled && msg.scheduledAt && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 border-amber-500/30 text-amber-600 bg-amber-500/10">
                                                            <CalendarDays className="h-2.5 w-2.5" />
                                                            Scheduled for {formatScheduledDate(msg.scheduledAt)}
                                                        </Badge>
                                                    )}

                                                    {/* Cancelled badge */}
                                                    {isCancelled && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 border-red-500/30 text-red-500 bg-red-500/10">
                                                            <X className="h-2.5 w-2.5" />
                                                            Cancelled
                                                        </Badge>
                                                    )}

                                                    {/* Email tracking indicators for outbound emails */}
                                                    {isOutbound && msg.type === "email" && !isScheduled && !isCancelled && (() => {
                                                        const tracking = trackingData.find((t: any) => {
                                                            if (msg.content?.includes(`Subject: ${t.subject}`)) return true;
                                                            const msgTime = new Date(msg.createdAt).getTime();
                                                            const trackTime = new Date(t.sentAt).getTime();
                                                            return Math.abs(msgTime - trackTime) < 60000;
                                                        });
                                                        if (!tracking) return null;
                                                        return (
                                                            <div className="flex items-center gap-1.5">
                                                                {tracking.opened ? (
                                                                    <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 border-emerald-400/40 text-emerald-300 bg-emerald-500/10">
                                                                        <Eye className="h-2.5 w-2.5" />
                                                                        Opened{tracking.openCount > 1 ? ` (${tracking.openCount})` : ""}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 border-border text-primary-foreground/40">
                                                                        <Eye className="h-2.5 w-2.5" />
                                                                        Not opened
                                                                    </Badge>
                                                                )}
                                                                {tracking.totalClicks > 0 && (
                                                                    <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 border-blue-400/40 text-blue-300 bg-blue-500/10">
                                                                        <MousePointerClick className="h-2.5 w-2.5" />
                                                                        {tracking.totalClicks} click{tracking.totalClicks !== 1 ? "s" : ""}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isCancelled ? "line-through" : ""}`}>{msg.content}</p>

                                                {/* Attachment chips in messages */}
                                                {msg.attachments?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {msg.attachments.map((att: any, i: number) => (
                                                            <a
                                                                key={i}
                                                                href={att.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-background/80 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-800 transition-colors underline-offset-2 hover:underline"
                                                            >
                                                                <FileText className="h-3 w-3 shrink-0" />
                                                                {att.filename}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between">
                                                    <p className={`text-xs ${
                                                        isOutbound && !isScheduled && !isCancelled
                                                            ? "text-primary-foreground/50"
                                                            : "text-muted-foreground"
                                                    }`}>
                                                        {formatTime(msg.createdAt)}
                                                    </p>

                                                    {/* Cancel button for scheduled messages */}
                                                    {isScheduled && (
                                                        <button
                                                            onClick={() => handleCancelScheduled(msg.id)}
                                                            className="text-xs text-amber-600 hover:text-red-500 font-medium transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                    {/* Reply button */}
                                                    {!isScheduled && !isCancelled && (
                                                        <button
                                                            onClick={() => {
                                                                setReplyToMessage(msg)
                                                                textareaRef.current?.focus()
                                                            }}
                                                            className={`text-xs font-medium transition-colors flex items-center gap-0.5 opacity-0 group-hover:opacity-100 ${
                                                                isOutbound && !isScheduled && !isCancelled
                                                                    ? "text-primary-foreground/50 hover:text-primary-foreground/80"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            <Reply className="h-3 w-3" />
                                                            Reply
                                                        </button>
                                                    )}
                                                    {/* Delete button */}
                                                    <button
                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                        className={`text-xs font-medium transition-colors flex items-center gap-0.5 opacity-0 group-hover:opacity-100 ${
                                                            isOutbound && !isScheduled && !isCancelled
                                                                ? "text-primary-foreground/50 hover:text-red-300"
                                                                : "text-muted-foreground hover:text-red-500"
                                                        }`}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Compose */}
                            <div className="p-3 sm:p-4 border-t bg-muted/10 shrink-0 relative">
                                {/* Reply indicator */}
                                {replyToMessage && (
                                    <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                                        <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <p className="text-xs text-muted-foreground truncate flex-1">
                                            Replying to: <span className="font-medium text-foreground">{replyToMessage.content?.substring(0, 80)}{replyToMessage.content?.length > 80 ? "..." : ""}</span>
                                        </p>
                                        <button onClick={() => setReplyToMessage(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                                {/* Schedule Picker */}
                                {showSchedulePicker && (
                                    <SchedulePicker
                                        onSchedule={handleSchedule}
                                        onClose={() => setShowSchedulePicker(false)}
                                        isSending={isSending}
                                    />
                                )}

                                {/* Snippets Manager */}
                                {showSnippets && (
                                    <SnippetsManager
                                        onInsert={handleInsertSnippet}
                                        onClose={() => setShowSnippets(false)}
                                    />
                                )}

                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Send as:</span>
                                    {["email", "text"].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setMessageType(t)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border touch-manipulation ${messageType === t
                                                    ? `${typeColor(t)} border-current`
                                                    : "text-muted-foreground border-transparent hover:bg-muted"
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>

                                {/* Attachment chips */}
                                {attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {attachments.map((att, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border text-xs"
                                            >
                                                <FileText className="h-3 w-3 text-muted-foreground" />
                                                <span className="truncate max-w-[120px]">{att.filename}</span>
                                                <button
                                                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-muted-foreground hover:text-destructive shrink-0"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Rich text formatting toolbar */}
                                {messageType === "email" && (
                                    <div className="flex items-center gap-0.5 mb-2 px-1">
                                        {[
                                            { icon: Bold, label: "Bold", prefix: "**", suffix: "**" },
                                            { icon: Italic, label: "Italic", prefix: "_", suffix: "_" },
                                            { icon: Link2, label: "Link", prefix: "[", suffix: "](url)" },
                                            { icon: List, label: "List", prefix: "\n- ", suffix: "" },
                                        ].map(({ icon: Icon, label, prefix, suffix }) => (
                                            <button
                                                key={label}
                                                type="button"
                                                title={label}
                                                onClick={() => {
                                                    const ta = textareaRef.current
                                                    if (!ta) return
                                                    const start = ta.selectionStart
                                                    const end = ta.selectionEnd
                                                    const selected = newMessage.substring(start, end) || label.toLowerCase()
                                                    const before = newMessage.substring(0, start)
                                                    const after = newMessage.substring(end)
                                                    setNewMessage(before + prefix + selected + suffix + after)
                                                    setTimeout(() => {
                                                        ta.focus()
                                                        ta.selectionStart = start + prefix.length
                                                        ta.selectionEnd = start + prefix.length + selected.length
                                                    }, 0)
                                                }}
                                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                            >
                                                <Icon className="h-3.5 w-3.5" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-end gap-2">
                                    {/* Compose toolbar */}
                                    <div className="flex flex-col gap-1">
                                        {/* Snippets button */}
                                        <button
                                            onClick={() => { setShowSnippets(!showSnippets); setShowSchedulePicker(false) }}
                                            className={`p-1.5 rounded-md transition-colors ${showSnippets ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                                            title="Quick snippets"
                                        >
                                            <Zap className="h-4 w-4" />
                                        </button>

                                        {/* Attachment button (only for email) */}
                                        {messageType === "email" && (
                                            <AttachmentPicker
                                                contactId={selectedContactId}
                                                attachments={attachments}
                                                onAdd={(att) => setAttachments(prev => [...prev, att])}
                                                onRemove={(idx) => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                            />
                                        )}
                                    </div>

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
                                        placeholder="Type your message..."
                                        rows={2}
                                        className="flex-1 min-w-0 resize-none rounded-xl border border-input bg-background px-3 sm:px-4 py-2.5 text-base sm:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[44px]"
                                    />

                                    <div className="flex flex-col gap-1 shrink-0">
                                        <Button
                                            onClick={handleSend}
                                            disabled={isSending || !newMessage.trim()}
                                            className="h-10 min-h-[44px] px-4 rounded-xl touch-manipulation"
                                        >
                                            <Send className="h-4 w-4 mr-1" />
                                            {isSending ? "..." : "Send"}
                                        </Button>
                                        {messageType === "email" && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => { setShowSchedulePicker(!showSchedulePicker); setShowSnippets(false) }}
                                                disabled={!newMessage.trim()}
                                                className={`h-7 text-xs rounded-lg ${showSchedulePicker ? "border-primary text-primary" : ""}`}
                                            >
                                                <Clock className="h-3 w-3 mr-1" />
                                                Schedule
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
