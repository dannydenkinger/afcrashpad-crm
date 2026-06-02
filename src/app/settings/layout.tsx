import { SettingsSubNav } from "./SettingsSubNav"

/**
 * The SubNav uses `position: sticky` to pin to the top of the *parent*
 * scroll container (AppShell's <main>). We deliberately do NOT add a
 * second `overflow-y-auto` here — nested scroll containers would break
 * sticky positioning, since each scroll context resets sticky behavior.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <SettingsSubNav />
            {children}
        </>
    )
}
