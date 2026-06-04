import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { User, Bell, Compass, ShieldAlert } from "lucide-react"
import { SettingsSubPageLayout, type SubPageItem } from "../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

const PROFILE_NAV: SubPageItem[] = [
    {
        slug: "personal",
        label: "Personal info",
        description: "Name, photo, phone — visible to teammates",
        icon: <User className="w-4 h-4" />,
        accent: "blue",
    },
    {
        slug: "notifications",
        label: "Notifications",
        description: "Pick what gets emailed and what pings the bell",
        icon: <Bell className="w-4 h-4" />,
        accent: "amber",
    },
    {
        slug: "onboarding",
        label: "Onboarding",
        description: "Re-walk the integration setup",
        icon: <Compass className="w-4 h-4" />,
        accent: "violet",
    },
    {
        slug: "danger-zone",
        label: "Account & danger zone",
        description: "Leave, transfer, or delete your account",
        icon: <ShieldAlert className="w-4 h-4" />,
        accent: "rose",
    },
]

export default async function ProfileSettingsLayout({ children }: { children: React.ReactNode }) {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")

    return (
        <SettingsSubPageLayout
            basePath="/settings/profile"
            areaTitle="Profile"
            areaDescription="Your personal info and how AFCrashpad tells you about things."
            items={PROFILE_NAV}
        >
            {children}
        </SettingsSubPageLayout>
    )
}
