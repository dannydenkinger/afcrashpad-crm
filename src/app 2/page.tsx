"use client"

import { Button } from "@/components/ui/button"
import { Plane } from "lucide-react"
import { signIn } from "next-auth/react"

export default function Home() {
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
