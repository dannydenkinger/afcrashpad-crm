"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Save, Plus, X, ArrowLeft } from "lucide-react"
import type { HaroSettings as HaroSettingsType } from "./types"
import { DEFAULT_HARO_SETTINGS } from "./types"
import { saveHaroSettings } from "./actions"

interface Props {
    settings: HaroSettingsType | null
    onBack: () => void
    onSaved: () => void
}

export function HaroSettings({ settings: initial, onBack, onSaved }: Props) {
    const [settings, setSettings] = useState<HaroSettingsType>(initial || DEFAULT_HARO_SETTINGS)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState("")
    const [newTopic, setNewTopic] = useState("")

    const update = <K extends keyof HaroSettingsType>(key: K, value: HaroSettingsType[K]) =>
        setSettings(prev => ({ ...prev, [key]: value }))

    const addTopic = () => {
        const topic = newTopic.trim().toLowerCase()
        if (topic && !settings.expertiseTopics.includes(topic)) {
            update("expertiseTopics", [...settings.expertiseTopics, topic])
            setNewTopic("")
        }
    }

    const removeTopic = (topic: string) =>
        update("expertiseTopics", settings.expertiseTopics.filter(t => t !== topic))

    const handleSave = async () => {
        setSaving(true)
        setSaveError("")
        try {
            const result = await saveHaroSettings(settings)
            if (result.success) {
                onSaved()
            } else {
                setSaveError(result.error || "Failed to save")
            }
        } catch (err: any) {
            setSaveError(err.message || "Failed to save settings")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-lg font-semibold">HARO Settings</h2>
                    <p className="text-xs text-muted-foreground">Configure your profile, expertise, and automation preferences</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {saveError && <span className="text-xs text-rose-500">{saveError}</span>}
                    <Button onClick={handleSave} disabled={saving} size="sm">
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        {saving ? "Saving..." : "Save Settings"}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Bio & Credentials */}
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-semibold">Profile & Credentials</CardTitle>
                        <CardDescription className="text-xs">Your bio used in AI-generated responses</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Full Name</Label>
                                <Input value={settings.name} onChange={e => update("name", e.target.value)} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Business Name</Label>
                                <Input value={settings.businessName} onChange={e => update("businessName", e.target.value)} className="h-9 text-sm" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Business Intro</Label>
                            <Textarea
                                value={settings.businessIntro}
                                onChange={e => update("businessIntro", e.target.value)}
                                placeholder="a successful business owner in the [industry] space"
                                className="text-sm min-h-[60px]"
                            />
                            <p className="text-[10px] text-muted-foreground">Used as: &quot;I&apos;m [name], founder of [business], [this intro]&quot;</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">LinkedIn</Label>
                                <Input value={settings.linkedIn} onChange={e => update("linkedIn", e.target.value)} className="h-9 text-sm" placeholder="https://linkedin.com/in/..." />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Website</Label>
                                <Input value={settings.website} onChange={e => update("website", e.target.value)} className="h-9 text-sm" placeholder="https://..." />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Instagram</Label>
                                <Input value={settings.instagram} onChange={e => update("instagram", e.target.value)} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Twitter/X</Label>
                                <Input value={settings.twitter} onChange={e => update("twitter", e.target.value)} className="h-9 text-sm" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Headshot URL</Label>
                            <Input value={settings.headshotUrl} onChange={e => update("headshotUrl", e.target.value)} className="h-9 text-sm" placeholder="https://..." />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Email Sign-off</Label>
                            <Textarea
                                value={settings.signoff}
                                onChange={e => update("signoff", e.target.value)}
                                className="text-sm min-h-[80px]"
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    {/* Expertise Topics */}
                    <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-semibold">Expertise Topics</CardTitle>
                            <CardDescription className="text-xs">AI uses these to filter relevant HARO queries</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                                {settings.expertiseTopics.map(topic => (
                                    <Badge key={topic} variant="secondary" className="text-xs gap-1 pr-1">
                                        {topic}
                                        <button onClick={() => removeTopic(topic)} className="ml-0.5 hover:text-destructive">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={newTopic}
                                    onChange={e => setNewTopic(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTopic())}
                                    placeholder="Add topic..."
                                    className="h-8 text-sm flex-1"
                                />
                                <Button size="sm" variant="outline" className="h-8" onClick={addTopic} disabled={!newTopic.trim()}>
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Response Style */}
                    <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-semibold">Response Style</CardTitle>
                            <CardDescription className="text-xs">Customize how AI-generated responses sound</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label className="text-xs">Tone</Label>
                                    <span className="text-xs font-bold text-primary">
                                        {settings.responseTone <= 30 ? "Casual" : settings.responseTone <= 70 ? "Balanced" : "Professional"}
                                    </span>
                                </div>
                                <Slider
                                    value={[settings.responseTone]}
                                    onValueChange={([v]) => update("responseTone", v)}
                                    min={0}
                                    max={100}
                                    step={5}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Casual</span>
                                    <span>Professional</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Response Length</Label>
                                    <Select value={settings.responseLength} onValueChange={v => update("responseLength", v as any)}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="short">Short</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="long">Long</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Writing Style</Label>
                                    <Select value={settings.responseStyle} onValueChange={v => update("responseStyle", v as any)}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="friendly_expert">Friendly Expert</SelectItem>
                                            <SelectItem value="thought_leader">Thought Leader</SelectItem>
                                            <SelectItem value="storyteller">Storyteller</SelectItem>
                                            <SelectItem value="data_driven">Data-Driven</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Include Anecdotes</p>
                                    <p className="text-[10px] text-muted-foreground">Encourage real examples and stories</p>
                                </div>
                                <Switch checked={settings.includeAnecdotes} onCheckedChange={v => update("includeAnecdotes", v)} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Include Call-to-Action</p>
                                    <p className="text-[10px] text-muted-foreground">Add availability note at the end</p>
                                </div>
                                <Switch checked={settings.includeCallToAction} onCheckedChange={v => update("includeCallToAction", v)} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Relevancy Tuning */}
                    <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-semibold">Relevancy Tuning</CardTitle>
                            <CardDescription className="text-xs">Control how strictly queries are matched to your expertise</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <Label className="text-xs">Strictness</Label>
                                <span className="text-xs font-bold text-primary">
                                    {settings.relevancyStrictness <= 30 ? "Loose" : settings.relevancyStrictness <= 70 ? "Balanced" : "Strict"}
                                </span>
                            </div>
                            <Slider
                                value={[settings.relevancyStrictness]}
                                onValueChange={([v]) => update("relevancyStrictness", v)}
                                min={0}
                                max={100}
                                step={5}
                                className="w-full"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Loose — wide net</span>
                                <span>Strict — exact matches</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">
                                Loose catches more opportunities but may include tangential matches. Strict only surfaces queries directly related to your expertise topics.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Automation Settings */}
                    <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-semibold">Automation</CardTitle>
                            <CardDescription className="text-xs">How responses are handled</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">HARO Automation</p>
                                    <p className="text-[10px] text-muted-foreground">Enable automatic processing</p>
                                </div>
                                <Switch checked={settings.enabled} onCheckedChange={v => update("enabled", v)} />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs font-semibold">Send Mode</Label>
                                <div className="space-y-2">
                                    {([
                                        { value: "draft" as const, label: "Draft for Review", desc: "AI generates, you review before sending" },
                                        { value: "auto_with_threshold" as const, label: "Auto-send (High Confidence)", desc: "Auto-send when relevance score exceeds threshold" },
                                        { value: "auto" as const, label: "Fully Automatic", desc: "All relevant responses sent immediately" },
                                    ]).map(mode => (
                                        <label
                                            key={mode.value}
                                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${settings.sendMode === mode.value ? "border-primary bg-primary/5" : "border-transparent bg-muted/20 hover:bg-muted/30"}`}
                                        >
                                            <input
                                                type="radio"
                                                name="sendMode"
                                                value={mode.value}
                                                checked={settings.sendMode === mode.value}
                                                onChange={() => update("sendMode", mode.value)}
                                                className="mt-0.5"
                                            />
                                            <div>
                                                <p className="text-xs font-semibold">{mode.label}</p>
                                                <p className="text-[10px] text-muted-foreground">{mode.desc}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {settings.sendMode === "auto_with_threshold" && (
                                <div className="space-y-2 pl-1">
                                    <div className="flex justify-between">
                                        <Label className="text-xs">Confidence Threshold</Label>
                                        <span className="text-xs font-bold text-primary">{settings.confidenceThreshold}%</span>
                                    </div>
                                    <Slider
                                        value={[settings.confidenceThreshold]}
                                        onValueChange={([v]) => update("confidenceThreshold", v)}
                                        min={50}
                                        max={95}
                                        step={5}
                                        className="w-full"
                                    />
                                    <p className="text-[10px] text-muted-foreground">Queries scoring above this are auto-sent; below go to drafts</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Email Config */}
                    <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-semibold">Email Configuration</CardTitle>
                            <CardDescription className="text-xs">Email sending and HARO identification</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Send From Email</Label>
                                    <Input value={settings.sendFromEmail} onChange={e => update("sendFromEmail", e.target.value)} className="h-9 text-sm" placeholder="you@domain.com" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Reply-To Email</Label>
                                    <Input value={settings.replyToEmail} onChange={e => update("replyToEmail", e.target.value)} className="h-9 text-sm" placeholder="you@domain.com" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">HARO Sender Email</Label>
                                    <Input value={settings.haroSenderEmail} onChange={e => update("haroSenderEmail", e.target.value)} className="h-9 text-sm" placeholder="haro@helpareporter.com" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Subject Keyword</Label>
                                    <Input value={settings.haroSubjectKeyword} onChange={e => update("haroSubjectKeyword", e.target.value)} className="h-9 text-sm" placeholder="HARO" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
