import { redirect } from "next/navigation"

/**
 * Workspace settings is now a layout with sub-routes. Hitting the bare
 * /settings/workspace URL drops you into Identity by default — first
 * thing most users want to set anyway.
 */
export default function WorkspaceSettingsRoot() {
    redirect("/settings/workspace/identity")
}
