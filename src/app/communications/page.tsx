"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
    Search, Send, Mail, MessageSquare, Phone, Filter,
    ArrowLeft, Plus, User, Clock, ChevronDown
} from "lucide-react"
import { getConversations, getMessages, sendMessage, getAllContacts } from "./actions"

export default function CommunicationsPage() {
    const [conversations, setConversations] = useState<any[]>([])
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [contact, setContact] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingThread, setIsLoadingThread] = useState(false)
    const [search, setSearch] = useState("")
    const [newMessage, setNewMessage] = useState("")
    const [messageType, setMessageType] = useState("email")
    const [isSending, setIsSending] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string>("all")
    const [showNewConvo, setShowNewConvo] = useState(false)
    const [allContacts, setAllContacts] = useState<any[]>([])
    const [contactSearch, setContactSearch] = useState("")
    const messagesEndRef = useRef<HTMLDivElement>(null)

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

    const openThread = async (contactId: string) => {
        setIsLoadingThread(true)
        setSelectedContactId(contactId)
        setShowNewConvo(false)
        const res = await getMessages(contactId)
        if (res.success) {
            setMessages(res.messages || [])
            setContact(res.contact)
        }
        setIsLoadingThread(false)
    }

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedContactId) return
        setIsSending(true)
        const res = await sendMessage(selectedContactId, messageType, newMessage.trim())
        if (res.success) {
            setNewMessage("")
            // Refresh thread
            const threadRes = await getMessages(selectedContactId)
            if (threadRes.success) setMessages(threadRes.messages || [])
            fetchConversations()
        }
        setIsSending(false)
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
        const matchesSearch = c.contactName?.toLowerCase().includes(search.toLowerCase()) ||
            c.email?.toLowerCase().includes(search.toLowerCase())
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

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] min-h-0">
            {/* Header */}
            <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 shrink-0">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Communications</h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Track all conversations with clients and leads.</p>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row mx-0 sm:mx-4 lg:mx-8 mb-0 sm:mb-6 border-y sm:border rounded-none sm:rounded-xl overflow-hidden bg-card shadow-sm min-h-0">
                {/* Left Panel: Conversation List */}
                <div className={`w-full sm:w-[380px] border-r flex-col bg-muted/10 shrink-0 ${selectedContactId ? 'hidden sm:flex' : 'flex'} min-h-0`}>
                    {/* Search + Actions */}
                    <div className="p-3 space-y-2 border-b">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search conversations..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-8 pl-8 text-sm"
                                />
                            </div>
                            <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={startNewConversation}>
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        {/* Type Filter Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                                { value: "all", label: "All" },
                                { value: "email", label: "Email" },
                                { value: "text", label: "Text" },
                                { value: "phone", label: "Phone" }
                            ].map(f => (
                                <button
                                    key={f.value}
                                    onClick={() => setTypeFilter(f.value)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors border ${typeFilter === f.value
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
                                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{c.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-medium truncate">{c.name}</span>
                                            <span className="text-[10px] text-muted-foreground truncate">{c.email}</span>
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
                            <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground gap-2">
                                <MessageSquare className="h-8 w-8 opacity-30" />
                                <span>No conversations yet</span>
                                <Button size="sm" variant="outline" onClick={startNewConversation}>
                                    <Plus className="h-3 w-3 mr-1" /> Start one
                                </Button>
                            </div>
                        ) : filteredConversations.map(convo => (
                            <div
                                key={convo.contactId}
                                onClick={() => openThread(convo.contactId)}
                                className={`flex items-start gap-3 px-4 py-3 min-h-[56px] cursor-pointer transition-colors border-b border-border/30 touch-manipulation ${selectedContactId === convo.contactId
                                        ? "bg-primary/5 border-l-2 border-l-primary"
                                        : "hover:bg-muted/30 active:bg-muted/40"
                                    }`}
                            >
                                <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                                    <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-white text-xs font-medium">
                                        {convo.contactName?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-sm font-semibold truncate">{convo.contactName}</span>
                                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatTime(convo.lastMessageTime)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 gap-0.5 ${typeColor(convo.lastMessageType)}`}>
                                            {typeIcon(convo.lastMessageType)}
                                            {convo.lastMessageType}
                                        </Badge>
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                            {convo.lastMessageDirection === "inbound" ? "↓ In" : "↑ Out"}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{convo.lastMessage}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stats Footer */}
                    <div className="p-3 border-t text-[10px] text-muted-foreground text-center">
                        {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                    </div>
                </div>

                {/* Right Panel: Message Thread */}
                <div className={`flex-1 flex-col min-w-0 ${!selectedContactId ? 'hidden sm:flex' : 'flex'}`}>
                    {!selectedContactId ? (
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
                                        <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-white text-xs sm:text-sm font-medium">
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
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                                        <p className="text-sm">No messages yet</p>
                                        <p className="text-xs">Send the first message below</p>
                                    </div>
                                ) : messages.map((msg: any) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 space-y-1 ${msg.direction === "outbound"
                                                ? "bg-primary text-primary-foreground rounded-br-md"
                                                : "bg-muted rounded-bl-md"
                                            }`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className={`text-[9px] px-1 py-0 gap-0.5 border-white/20 ${msg.direction === "outbound" ? "text-primary-foreground/70" : ""
                                                    }`}>
                                                    {typeIcon(msg.type)}
                                                    {msg.type}
                                                </Badge>
                                            </div>
                                            <p className="text-sm leading-relaxed">{msg.content}</p>
                                            <p className={`text-[10px] ${msg.direction === "outbound" ? "text-primary-foreground/50" : "text-muted-foreground"
                                                }`}>
                                                {formatTime(msg.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Compose */}
                            <div className="p-3 sm:p-4 border-t bg-muted/10 shrink-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Send as:</span>
                                    {["email", "text", "phone"].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setMessageType(t)}
                                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors border touch-manipulation ${messageType === t
                                                    ? `${typeColor(t)} border-current`
                                                    : "text-muted-foreground border-transparent hover:bg-muted"
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-end gap-2">
                                    <textarea
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
                                        className="flex-1 min-w-0 resize-none rounded-xl border border-input bg-background px-3 sm:px-4 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[44px]"
                                    />
                                    <Button
                                        onClick={handleSend}
                                        disabled={isSending || !newMessage.trim()}
                                        className="h-10 min-h-[44px] px-4 rounded-xl touch-manipulation shrink-0"
                                    >
                                        <Send className="h-4 w-4 mr-1" />
                                        {isSending ? "..." : "Send"}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
