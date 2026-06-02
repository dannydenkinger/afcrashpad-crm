"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Props {
    /** Called as the user dictates — we append onto whatever's already typed. */
    onTranscript: (newText: string) => void
    /** When provided, the parent state is controlled. We replace it on dictation. */
    currentValue?: string
    /** Visual only — uses a smaller mic icon when true. */
    compact?: boolean
    /** Disable in-flight (e.g. while parent is saving). */
    disabled?: boolean
    className?: string
}

/**
 * Browser-native voice-to-text via SpeechRecognition. Works on Chrome
 * (desktop + Android), Safari iOS 14.5+, and Edge. Firefox doesn't ship
 * SpeechRecognition yet, so the button hides itself there rather than
 * showing a non-functional control.
 *
 * Use case: mobile users on a contact note field can tap-and-talk
 * instead of thumb-typing a five-line summary after a sales call.
 */
export function VoiceDictationButton({
    onTranscript,
    currentValue = "",
    compact = false,
    disabled = false,
    className,
}: Props) {
    const [supported, setSupported] = useState<boolean | null>(null)
    const [listening, setListening] = useState(false)
    const recognitionRef = useRef<any>(null)
    /** Snapshot of the user's text at the moment we started listening, so
     *  partial transcripts can be appended without losing what they
     *  already typed manually. */
    const baselineRef = useRef<string>("")

    useEffect(() => {
        if (typeof window === "undefined") {
            setSupported(false)
            return
        }
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        setSupported(!!SR)
    }, [])

    const start = () => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SR) {
            toast.error("Voice dictation isn't supported in this browser")
            return
        }
        baselineRef.current = currentValue.trimEnd()

        const rec = new SR()
        rec.continuous = true       // Keep listening until the user stops
        rec.interimResults = true   // Stream partial transcripts as they arrive
        rec.lang = "en-US"

        rec.onresult = (event: any) => {
            // Concatenate all results so far, both finalized and interim.
            // We rebuild from event.results each time rather than appending
            // because Chrome reuses indices for in-progress utterances.
            let interim = ""
            let final = ""
            for (let i = 0; i < event.results.length; i++) {
                const r = event.results[i]
                if (r.isFinal) final += r[0].transcript
                else interim += r[0].transcript
            }
            const combined = `${final}${interim}`.trim()
            const merged = baselineRef.current
                ? `${baselineRef.current}\n${combined}`
                : combined
            onTranscript(merged)
        }

        rec.onerror = (event: any) => {
            console.error("[voice] error:", event.error)
            if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                toast.error("Microphone access denied — enable it in your browser settings")
            } else if (event.error === "no-speech") {
                // Don't toast — common, harmless
            } else {
                toast.error(`Voice error: ${event.error}`)
            }
            setListening(false)
        }

        rec.onend = () => {
            setListening(false)
        }

        recognitionRef.current = rec
        try {
            rec.start()
            setListening(true)
        } catch (err) {
            console.error("[voice] failed to start:", err)
            toast.error("Couldn't start voice dictation")
            setListening(false)
        }
    }

    const stop = () => {
        try {
            recognitionRef.current?.stop()
        } catch {
            /* harmless if already stopped */
        }
        setListening(false)
    }

    // Don't render if not supported — better than a non-functional button.
    if (supported === false) return null
    // While probing capabilities, render nothing (avoids hydration flash).
    if (supported === null) return null

    return (
        <Button
            type="button"
            size={compact ? "sm" : "default"}
            variant={listening ? "default" : "ghost"}
            disabled={disabled}
            onClick={listening ? stop : start}
            className={className}
            title={listening ? "Tap to stop" : "Tap to dictate"}
        >
            {listening ? (
                <>
                    <span className="relative flex h-2 w-2 mr-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                    <Mic className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                </>
            ) : (
                <MicOff className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            )}
        </Button>
    )
}
