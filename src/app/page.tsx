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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4 sm:p-6">
      <div className="mx-auto w-full max-w-sm space-y-6 sm:space-y-8 flex flex-col items-center">
        <div className="flex flex-col items-center space-y-2 sm:space-y-3 text-center">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow mb-2 sm:mb-4">
            <Plane className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AFCrashpad CRM</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Sign in to access the portal
          </p>
        </div>

        {error === "AccessDenied" && (
          <div className="w-full rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-center">
            <p className="text-sm font-medium text-destructive">Access denied</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your account has not been added to this workspace. Contact your administrator to get access.
            </p>
          </div>
        )}

        <div className="w-full mt-4 sm:mt-8">
          <Button
            size="lg"
            className="w-full font-medium min-h-[48px] sm:min-h-0 touch-manipulation"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Sign in with Google
          </Button>
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
