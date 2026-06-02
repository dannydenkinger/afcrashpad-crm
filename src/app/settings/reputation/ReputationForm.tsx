"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import type { ReputationSettings } from "./actions"
import { updateReputationSettings } from "./actions"

export function ReputationForm({ initial }: { initial: ReputationSettings | null }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const [google, setGoogle] = useState(initial?.googleReviewUrl ?? "")
    const [facebook, setFacebook] = useState(initial?.facebookReviewUrl ?? "")
    const [yelp, setYelp] = useState(initial?.yelpReviewUrl ?? "")
    const [customUrl, setCustomUrl] = useState(initial?.customReviewUrl ?? "")
    const [customLabel, setCustomLabel] = useState(initial?.customReviewLabel ?? "")
    const [subject, setSubject] = useState(initial?.emailSubject ?? "Quick favor — would you leave us a review?")
    const [intro, setIntro] = useState(
        initial?.emailIntro ??
            "Thanks again for working with us. If you have a minute, a quick review would mean a lot — it helps other people find us.",
    )

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateReputationSettings({
                googleReviewUrl: google.trim(),
                facebookReviewUrl: facebook.trim(),
                yelpReviewUrl: yelp.trim(),
                customReviewUrl: customUrl.trim(),
                customReviewLabel: customLabel.trim(),
                emailSubject: subject.trim(),
                emailIntro: intro.trim(),
            })
            if (!res.success) {
                toast.error(res.error || "Failed to save")
                return
            }
            toast.success("Saved")
            router.refresh()
        })
    }

    return (
        <Card>
            <CardContent className="p-5 space-y-6">
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Review destinations
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Paste the public URL where customers can leave a review. Each link you fill in becomes a button in the email.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Google Business profile</Label>
                            <Input
                                type="url"
                                value={google}
                                onChange={(e) => setGoogle(e.target.value)}
                                placeholder="https://g.page/r/..."
                                disabled={isPending}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Facebook page</Label>
                            <Input
                                type="url"
                                value={facebook}
                                onChange={(e) => setFacebook(e.target.value)}
                                placeholder="https://facebook.com/.../reviews"
                                disabled={isPending}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Yelp profile</Label>
                            <Input
                                type="url"
                                value={yelp}
                                onChange={(e) => setYelp(e.target.value)}
                                placeholder="https://yelp.com/biz/..."
                                disabled={isPending}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Custom URL</Label>
                            <Input
                                type="url"
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                placeholder="https://..."
                                disabled={isPending}
                            />
                        </div>
                        {customUrl && (
                            <div className="space-y-1 md:col-span-2">
                                <Label className="text-xs">Custom URL button label</Label>
                                <Input
                                    value={customLabel}
                                    onChange={(e) => setCustomLabel(e.target.value)}
                                    placeholder="Leave a review"
                                    disabled={isPending}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3 pt-3 border-t">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Email template
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Tokens: <code className="text-foreground">{"{{first_name}}"}</code> and{" "}
                        <code className="text-foreground">{"{{company}}"}</code>.
                    </p>
                    <div className="space-y-1">
                        <Label className="text-xs">Subject</Label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Quick favor — would you leave us a review?"
                            disabled={isPending}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Body intro</Label>
                        <Textarea
                            value={intro}
                            onChange={(e) => setIntro(e.target.value)}
                            rows={4}
                            disabled={isPending}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-3 border-t">
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Save
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
