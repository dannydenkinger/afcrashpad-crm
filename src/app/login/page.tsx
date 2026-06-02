"use client"

import { useState } from "react"
import { Eye, EyeOff, Hexagon, Loader2 } from "lucide-react"
import { signIn } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import { ModeToggle } from "@/components/theme-toggle"


// --- HELPER COMPONENTS ---

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

// --- SIGN IN CONTENT ---

function SignInContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const error = searchParams.get("error")

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [authError, setAuthError] = useState<string | null>(null)
    const [showForgotPassword, setShowForgotPassword] = useState(false)

    const handleCredentialsSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setAuthError(null)
        setLoading(true)

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        })

        setLoading(false)

        if (result?.error) {
            setAuthError("Invalid email or password")
            return
        }

        router.push("/dashboard")
    }

    const displayError = authError
        || (error === "AccessDenied" ? "Your account has not been added to this workspace. Contact your administrator." : null)
        || (error === "CredentialsSignin" ? "Invalid email or password" : null)

    return (
        <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw]">
            <div className="absolute top-4 right-4 z-10">
                <ModeToggle />
            </div>
            {/* Left column: sign-in form */}
            <section className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    <div className="flex flex-col gap-6">
                        <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">
                            <span className="font-light text-foreground tracking-tighter">Welcome</span>
                        </h1>
                        <p className="animate-element animate-delay-200 text-muted-foreground">
                            Sign in to your CRM portal to manage your sales pipeline
                        </p>

                        {displayError && (
                            <div className="animate-element rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center">
                                <p className="text-sm font-medium text-rose-400">{displayError}</p>
                            </div>
                        )}

                        <form className="space-y-5" onSubmit={handleCredentialsSignIn}>
                            <div className="animate-element animate-delay-300">
                                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                                <GlassInputWrapper>
                                    <input
                                        name="email"
                                        type="email"
                                        placeholder="Enter your email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none"
                                    />
                                </GlassInputWrapper>
                            </div>

                            <div className="animate-element animate-delay-400">
                                <label className="text-sm font-medium text-muted-foreground">Password</label>
                                <GlassInputWrapper>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-3 flex items-center"
                                        >
                                            {showPassword
                                                ? <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                                : <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                            }
                                        </button>
                                    </div>
                                </GlassInputWrapper>
                            </div>

                            <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" name="rememberMe" className="custom-checkbox" />
                                    <span className="text-foreground/90">Keep me signed in</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowForgotPassword(true)}
                                    className="text-violet-400 hover:underline transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Sign In
                            </button>
                        </form>

                        <div className="animate-element animate-delay-700 relative flex items-center justify-center">
                            <span className="w-full border-t border-border"></span>
                            <span className="px-4 text-sm text-muted-foreground bg-background absolute">Or continue with</span>
                        </div>

                        <button
                            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                            className="animate-element animate-delay-800 w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 hover:bg-secondary transition-colors"
                        >
                            <GoogleIcon />
                            Continue with Google
                        </button>

                        <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
                            New to the platform?{" "}
                            <button
                                onClick={() => router.push("/register")}
                                className="text-violet-400 hover:underline transition-colors"
                            >
                                Create Account
                            </button>
                        </p>
                    </div>
                </div>
            </section>

            {showForgotPassword && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowForgotPassword(false)}
                >
                    <div
                        className="max-w-md w-full rounded-2xl border border-border bg-background p-6 sm:p-8 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-semibold">Reset your password</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Self-serve password reset isn&apos;t enabled on this workspace yet. To regain access:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                            <li>Ask your workspace owner or an admin to reset it for you in <span className="font-mono text-foreground/80">Settings → Team</span>.</li>
                            <li>Or sign in with Google if your account uses Google as its provider.</li>
                        </ol>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowForgotPassword(false)}
                                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted/30 transition-colors"
                            >
                                Got it
                            </button>
                            <button
                                type="button"
                                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
                            >
                                Try Google sign-in
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Right column: hero image */}
            <section className="hidden md:block flex-1 relative p-4">
                <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl overflow-hidden border border-violet-400/50 dark:border-white/5 bg-gradient-to-br from-violet-300 via-indigo-300 to-purple-400 dark:from-violet-600/20 dark:via-indigo-600/20 dark:to-purple-700/20 shadow-xl shadow-violet-500/10 dark:shadow-none">
                    {/* Decorative orbs */}
                    <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-violet-500/50 dark:bg-violet-500/20 blur-3xl" />
                    <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-indigo-500/40 dark:bg-indigo-500/15 blur-3xl" />
                    <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/3 h-48 w-48 rounded-full bg-fuchsia-400/30 dark:bg-fuchsia-500/10 blur-3xl" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                        <div className="space-y-6">
                            <div className="animate-element animate-delay-500 h-20 w-20 mx-auto rounded-2xl bg-white/85 dark:bg-violet-500/20 border border-white/60 dark:border-violet-400/30 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-violet-900/10">
                                <Hexagon className="h-10 w-10 text-violet-700 dark:text-violet-400" />
                            </div>
                            <h2 className="animate-element animate-delay-600 text-3xl font-semibold tracking-tight text-violet-950 dark:text-foreground/90">
                                Streamline Your Sales
                            </h2>
                            <p className="animate-element animate-delay-700 text-lg max-w-sm mx-auto leading-relaxed text-violet-950/85 dark:text-muted-foreground">
                                Manage your pipeline, track communications, and close deals faster with an all-in-one CRM built for modern teams.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense>
            <SignInContent />
        </Suspense>
    )
}
