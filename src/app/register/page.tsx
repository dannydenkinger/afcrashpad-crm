"use client"

import { Suspense, useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Eye, EyeOff, Hexagon, Loader2 } from "lucide-react"
import { registerUser } from "./actions"
import { ModeToggle } from "@/components/theme-toggle"
import { trackClient } from "@/lib/posthog/client"

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
    </svg>
)

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
        {children}
    </div>
)

export default function RegisterPage() {
    return (
        <Suspense fallback={null}>
            <RegisterPageInner />
        </Suspense>
    )
}

function RegisterPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const planParam = searchParams.get("plan")
    const plan = planParam === "pro" || planParam === "max" ? planParam : null
    const setupHref = plan ? `/setup?plan=${plan}` : "/setup"
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        trackClient({ name: "signup_started", props: { plan_intent: plan ?? "free" } })
        // Fire only on mount with the initial plan param.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [workspaceName, setWorkspaceName] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        startTransition(async () => {
            const result = await registerUser({ name, email, password, workspaceName: workspaceName || undefined })
            if (!result.success) {
                setError(result.error || "Registration failed")
                return
            }
            const signInResult = await signIn("credentials", {
                email,
                password,
                redirect: false,
            })
            if (signInResult?.error) {
                setError("Account created but sign-in failed. Try signing in manually.")
                return
            }
            trackClient({ name: "signup_completed", props: { plan_intent: plan ?? "free" } })
            router.push(setupHref)
        })
    }

    return (
        <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw]">
            <div className="absolute top-4 right-4 z-10">
                <ModeToggle />
            </div>
            {/* Left column: registration form */}
            <section className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
                <div className="w-full max-w-md">
                    <div className="flex flex-col gap-6">
                        <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">
                            <span className="font-light text-foreground tracking-tighter">Create account</span>
                        </h1>
                        <p className="animate-element animate-delay-200 text-muted-foreground">
                            Start managing your sales pipeline in under a minute
                        </p>

                        {error && (
                            <div className="animate-element rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center">
                                <p className="text-sm font-medium text-rose-400">{error}</p>
                            </div>
                        )}

                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div className="animate-element animate-delay-300">
                                <label className="text-sm font-medium text-muted-foreground">
                                    Workspace name <span className="text-muted-foreground/60">(optional)</span>
                                </label>
                                <GlassInputWrapper>
                                    <input
                                        type="text"
                                        placeholder="Acme Sales Team"
                                        value={workspaceName}
                                        onChange={(e) => setWorkspaceName(e.target.value)}
                                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none"
                                    />
                                </GlassInputWrapper>
                            </div>

                            <div className="animate-element animate-delay-400">
                                <label className="text-sm font-medium text-muted-foreground">Full name</label>
                                <GlassInputWrapper>
                                    <input
                                        type="text"
                                        placeholder="Your name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none"
                                    />
                                </GlassInputWrapper>
                            </div>

                            <div className="animate-element animate-delay-500">
                                <label className="text-sm font-medium text-muted-foreground">Email address</label>
                                <GlassInputWrapper>
                                    <input
                                        type="email"
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none"
                                    />
                                </GlassInputWrapper>
                            </div>

                            <div className="animate-element animate-delay-600">
                                <label className="text-sm font-medium text-muted-foreground">Password</label>
                                <GlassInputWrapper>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="At least 8 characters"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-3 flex items-center"
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword
                                                ? <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                                : <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                            }
                                        </button>
                                    </div>
                                </GlassInputWrapper>
                            </div>

                            <div className="animate-element animate-delay-700">
                                <label className="text-sm font-medium text-muted-foreground">Confirm password</label>
                                <GlassInputWrapper>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="Re-enter password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute inset-y-0 right-3 flex items-center"
                                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                        >
                                            {showConfirmPassword
                                                ? <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                                : <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                            }
                                        </button>
                                    </div>
                                </GlassInputWrapper>
                            </div>

                            <button
                                type="submit"
                                disabled={isPending}
                                className="animate-element animate-delay-800 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Create account
                            </button>

                            <p className="animate-element animate-delay-900 text-xs text-center text-muted-foreground">
                                By creating an account, you agree to our{" "}
                                <a href="/terms" className="text-violet-400 hover:underline">Terms of Service</a>
                                {" "}and{" "}
                                <a href="/privacy" className="text-violet-400 hover:underline">Privacy Policy</a>.
                            </p>
                        </form>

                        <div className="animate-element animate-delay-900 relative flex items-center justify-center">
                            <span className="w-full border-t border-border"></span>
                            <span className="px-4 text-sm text-muted-foreground bg-background absolute">Or continue with</span>
                        </div>

                        <button
                            onClick={() => signIn("google", { callbackUrl: setupHref })}
                            className="animate-element animate-delay-900 w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 hover:bg-secondary transition-colors"
                        >
                            <GoogleIcon />
                            Sign up with Google
                        </button>

                        <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <button
                                onClick={() => router.push("/login")}
                                className="text-violet-400 hover:underline transition-colors"
                            >
                                Sign in
                            </button>
                        </p>
                    </div>
                </div>
            </section>

            {/* Right column: hero panel */}
            <section className="hidden md:block flex-1 relative p-4">
                <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl overflow-hidden border border-violet-400/50 dark:border-white/5 bg-gradient-to-br from-violet-300 via-indigo-300 to-purple-400 dark:from-violet-600/20 dark:via-indigo-600/20 dark:to-purple-700/20 shadow-xl shadow-violet-500/10 dark:shadow-none">
                    <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-violet-500/50 dark:bg-violet-500/20 blur-3xl" />
                    <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-indigo-500/40 dark:bg-indigo-500/15 blur-3xl" />
                    <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/3 h-48 w-48 rounded-full bg-fuchsia-400/30 dark:bg-fuchsia-500/10 blur-3xl" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                        <div className="space-y-6">
                            <div className="animate-element animate-delay-500 h-20 w-20 mx-auto rounded-2xl bg-white/85 dark:bg-violet-500/20 border border-white/60 dark:border-violet-400/30 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-violet-900/10">
                                <Hexagon className="h-10 w-10 text-violet-700 dark:text-violet-400" />
                            </div>
                            <h2 className="animate-element animate-delay-600 text-3xl font-semibold tracking-tight text-violet-950 dark:text-foreground/90">
                                Built for closing more deals
                            </h2>
                            <p className="animate-element animate-delay-700 text-lg max-w-sm mx-auto leading-relaxed text-violet-950/85 dark:text-muted-foreground">
                                Pipeline, contacts, marketing, automations, and AI — all in one workspace your whole team can share.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
