"use client"

import { Button } from "@/components/ui/button"
import { Plane } from "lucide-react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function SignInContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4 sm:p-6">
      {/* Animated gradient background */}
      <div className="landing-gradient absolute inset-0" />

      {/* Floating orbs */}
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />
      <div className="landing-orb landing-orb-3" />

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-sm landing-fade-in">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center space-y-4 text-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-lg shadow-indigo-500/10">
            <Plane className="h-9 w-9 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              AFCrashpad
            </h1>
            <p className="text-sm text-zinc-400 mt-1.5 font-medium tracking-wide">
              Military Lodging CRM
            </p>
          </div>
        </div>

        {/* Glass card */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">Welcome Back</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Sign in to your CRM portal
            </p>
          </div>

          {error === "AccessDenied" && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center">
              <p className="text-sm font-medium text-rose-400">Access denied</p>
              <p className="text-xs text-zinc-400 mt-1">
                Your account has not been added to this workspace. Contact your administrator to get access.
              </p>
            </div>
          )}

          <Button
            size="lg"
            className="w-full font-medium min-h-[48px] touch-manipulation bg-white text-black hover:bg-zinc-200 transition-colors"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </Button>

          <p className="text-center text-[10px] text-zinc-600">
            Secured with Google OAuth 2.0
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  )
}
