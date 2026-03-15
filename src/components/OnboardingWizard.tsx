"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { getOnboardingCompleted, completeOnboarding as markOnboardingComplete } from "@/app/dashboard/setup-actions"

interface OnboardingStep {
    target: string
    title: string
    description: string
    placement: "top" | "bottom" | "left" | "right"
    mobileOnly?: boolean
    desktopOnly?: boolean
}

const steps: OnboardingStep[] = [
    {
        target: "[data-onboarding='welcome']",
        title: "Welcome to AFCrashpad CRM",
        description:
            "Let us give you a quick tour. We'll show you how to manage military crashpad operations efficiently — from tracking leads to managing stays and automating follow-ups.",
        placement: "bottom",
    },
    {
        target: "[aria-label='Main navigation']",
        title: "Sidebar Navigation",
        description:
            "This is your command center. Every section of the CRM lives here — pipeline, contacts, calendar, communications, and more. You'll spend most of your time navigating from this sidebar.",
        placement: "right",
        desktopOnly: true,
    },
    {
        target: "[data-onboarding='dashboard']",
        title: "Dashboard Overview",
        description:
            "See how your business is performing at a glance. Track occupancy rates, revenue trends, conversion rates, and pipeline value — all updated in real time so you can make informed decisions.",
        placement: "bottom",
    },
    {
        target: "[data-onboarding='pipeline']",
        title: "Pipeline Management",
        description:
            "This is where deals move through your sales process. Drag and drop between stages like Inquiry, Tour Scheduled, and Booked. Automations can trigger emails and tasks as deals progress.",
        placement: "bottom",
    },
    {
        target: "[data-onboarding='contacts']",
        title: "Contacts",
        description:
            "Your contact hub holds everyone — leads, active tenants, and past guests. Each contact has a full timeline of communications, documents, and stay history for complete context.",
        placement: "bottom",
    },
    {
        target: "[data-onboarding='settings']",
        title: "Settings & Automations",
        description:
            "Set up email templates, configure stage automations, manage team members, and connect integrations like Google Calendar. The more you automate here, the less manual work you'll do daily.",
        placement: "bottom",
    },
]

export function OnboardingWizard() {
    const [isActive, setIsActive] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
    const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({})
    const [isMobile, setIsMobile] = useState(false)
    const tooltipRef = useRef<HTMLDivElement>(null)

    // Filter steps based on device
    const activeSteps = steps.filter(s => {
        if (isMobile && s.desktopOnly) return false
        if (!isMobile && s.mobileOnly) return false
        return true
    })

    // Check if onboarding should show — Firestore first, localStorage fallback
    useEffect(() => {
        setIsMobile(window.innerWidth < 768)

        // Check localStorage first for instant decision (avoid flash)
        const localCompleted = localStorage.getItem("onboarding-completed")
        if (localCompleted === "true") return

        // Then check Firestore
        getOnboardingCompleted().then(completed => {
            if (completed) {
                // Sync to localStorage so we don't check Firestore again
                localStorage.setItem("onboarding-completed", "true")
                return
            }
            // Show onboarding after a short delay to let the page render
            const timer = setTimeout(() => setIsActive(true), 1500)
            return () => clearTimeout(timer)
        })
    }, [])

    const positionTooltip = useCallback(() => {
        const step = activeSteps[currentStep]
        if (!step) return

        const targetEl = document.querySelector(step.target)

        if (!targetEl) {
            setHighlightStyle({ display: "none" })
            setTooltipStyle({
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
            })
            return
        }

        const rect = targetEl.getBoundingClientRect()
        const padding = 8

        setHighlightStyle({
            position: "fixed",
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            borderRadius: "12px",
        })

        const style: React.CSSProperties = { position: "fixed" }

        switch (step.placement) {
            case "bottom":
                style.top = rect.bottom + padding + 12
                style.left = rect.left + rect.width / 2
                style.transform = "translateX(-50%)"
                break
            case "top":
                style.bottom = window.innerHeight - rect.top + padding + 12
                style.left = rect.left + rect.width / 2
                style.transform = "translateX(-50%)"
                break
            case "right":
                style.top = rect.top + rect.height / 2
                style.left = rect.right + padding + 12
                style.transform = "translateY(-50%)"
                break
            case "left":
                style.top = rect.top + rect.height / 2
                style.right = window.innerWidth - rect.left + padding + 12
                style.transform = "translateY(-50%)"
                break
        }

        setTooltipStyle(style)
    }, [currentStep, activeSteps])

    useEffect(() => {
        if (!isActive) return
        positionTooltip()

        const handleResize = () => positionTooltip()
        window.addEventListener("resize", handleResize)
        window.addEventListener("scroll", handleResize, true)

        return () => {
            window.removeEventListener("resize", handleResize)
            window.removeEventListener("scroll", handleResize, true)
        }
    }, [isActive, currentStep, positionTooltip])

    const finishOnboarding = useCallback(() => {
        setIsActive(false)
        localStorage.setItem("onboarding-completed", "true")
        markOnboardingComplete()
    }, [])

    const handleNext = useCallback(() => {
        if (currentStep < activeSteps.length - 1) {
            setCurrentStep((prev) => prev + 1)
        } else {
            finishOnboarding()
        }
    }, [currentStep, activeSteps.length, finishOnboarding])

    const handlePrev = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1)
        }
    }, [currentStep])

    const handleSkip = useCallback(() => {
        finishOnboarding()
    }, [finishOnboarding])

    if (!isActive) return null

    const step = activeSteps[currentStep]

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className="fixed inset-0 z-[9998] transition-opacity duration-300"
                style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
                onClick={handleSkip}
                aria-hidden="true"
            />

            {/* Spotlight cutout */}
            <div
                className="fixed z-[9999] pointer-events-none transition-all duration-300 ease-out"
                style={{
                    ...highlightStyle,
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
                }}
                aria-hidden="true"
            />

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                role="dialog"
                aria-label={`Onboarding step ${currentStep + 1} of ${activeSteps.length}`}
                className="fixed z-[10000] w-[340px] max-w-[90vw] animate-in fade-in zoom-in-95 duration-200"
                style={tooltipStyle}
            >
                <div className="rounded-xl border bg-card shadow-2xl p-5">
                    {/* Step indicator */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Step {currentStep + 1} of {activeSteps.length}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={handleSkip}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Progress bar */}
                    <div className="flex gap-1 mb-4">
                        {activeSteps.map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "h-1 flex-1 rounded-full transition-colors duration-300",
                                    i <= currentStep ? "bg-primary" : "bg-muted"
                                )}
                            />
                        ))}
                    </div>

                    {/* Content */}
                    <h3 className="text-base font-semibold mb-1.5">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        {step.description}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground"
                            onClick={handleSkip}
                        >
                            Skip Tour
                        </Button>
                        <div className="flex items-center gap-2">
                            {currentStep > 0 && (
                                <Button variant="outline" size="sm" onClick={handlePrev}>
                                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                                    Back
                                </Button>
                            )}
                            <Button size="sm" onClick={handleNext}>
                                {currentStep < activeSteps.length - 1 ? (
                                    <>
                                        Next
                                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                    </>
                                ) : (
                                    "Get Started"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
