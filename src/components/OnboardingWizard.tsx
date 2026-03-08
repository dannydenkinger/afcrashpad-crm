"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface OnboardingStep {
    target: string // CSS selector for element to highlight
    title: string
    description: string
    placement: "top" | "bottom" | "left" | "right"
}

const steps: OnboardingStep[] = [
    {
        target: "[data-onboarding='welcome']",
        title: "Welcome to AFCrashpad CRM",
        description:
            "Let us give you a quick tour of your new workspace. We will walk you through the key areas so you can get started right away.",
        placement: "bottom",
    },
    {
        target: "[aria-label='Main navigation']",
        title: "Sidebar Navigation",
        description:
            "Use the sidebar to navigate between different sections of the CRM. It includes your Dashboard, Pipeline, Contacts, Calendar, and more.",
        placement: "right",
    },
    {
        target: "[data-onboarding='dashboard']",
        title: "Dashboard Overview",
        description:
            "Your Dashboard shows key performance indicators, charts, forecasts, and a leaderboard at a glance. It is your command center.",
        placement: "bottom",
    },
    {
        target: "[data-onboarding='pipeline']",
        title: "Pipeline Management",
        description:
            "Track your deals through every stage with the Kanban board or list view. Drag and drop to update deal stages instantly.",
        placement: "bottom",
    },
    {
        target: "[data-onboarding='contacts']",
        title: "Contacts",
        description:
            "Manage all your leads, tenants, and past guests. Add notes, track documents, and view full communication history.",
        placement: "bottom",
    },
    {
        target: "[data-onboarding='settings']",
        title: "Settings",
        description:
            "Customize your workspace, manage users, configure automations, and set up email templates. You are all set to go!",
        placement: "bottom",
    },
]

const STORAGE_KEY = "onboarding-completed"

export function OnboardingWizard() {
    const [isActive, setIsActive] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
    const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({})
    const tooltipRef = useRef<HTMLDivElement>(null)

    // Check if onboarding should show
    useEffect(() => {
        const completed = localStorage.getItem(STORAGE_KEY)
        if (completed === "true") return

        // Small delay to let the page render
        const timer = setTimeout(() => {
            setIsActive(true)
        }, 1500)

        return () => clearTimeout(timer)
    }, [])

    const positionTooltip = useCallback(() => {
        const step = steps[currentStep]
        if (!step) return

        const targetEl = document.querySelector(step.target)

        if (!targetEl) {
            // If target not found (e.g., on a different page), center the tooltip
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

        // Highlight position
        setHighlightStyle({
            position: "fixed",
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            borderRadius: "12px",
        })

        // Tooltip position
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
    }, [currentStep])

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

    const completeOnboarding = useCallback(() => {
        setIsActive(false)
        localStorage.setItem(STORAGE_KEY, "true")
    }, [])

    const handleNext = useCallback(() => {
        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1)
        } else {
            completeOnboarding()
        }
    }, [currentStep, completeOnboarding])

    const handlePrev = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1)
        }
    }, [currentStep])

    const handleSkip = useCallback(() => {
        completeOnboarding()
    }, [completeOnboarding])

    if (!isActive) return null

    const step = steps[currentStep]

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
                aria-label={`Onboarding step ${currentStep + 1} of ${steps.length}`}
                className="fixed z-[10000] w-[340px] max-w-[90vw] animate-in fade-in zoom-in-95 duration-200"
                style={tooltipStyle}
            >
                <div className="rounded-xl border bg-card shadow-2xl p-5">
                    {/* Step indicator */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Step {currentStep + 1} of {steps.length}
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
                        {steps.map((_, i) => (
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
                                {currentStep < steps.length - 1 ? (
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
