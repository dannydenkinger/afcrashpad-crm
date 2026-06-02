/**
 * Automation engine — advances a single run by one or more steps.
 *
 *   advanceRun(runId)        — loads the run, runs nodes until the run pauses
 *                              (wait), completes, errors, or hits a safety cap
 *   processDueWaitingRuns()  — cron entry point: picks up runs whose wait
 *                              timer has elapsed and resumes them
 */

import {
    bumpAutomationStat,
    claimWaitingRun,
    findDueWaitingRuns,
    getAutomation,
    getRun,
    updateRun,
} from "./store"
import { loadActionContact, runAction, type ActionContext } from "./actions"
import type { AutomationRun } from "./types"

/** Hard cap on nodes processed per run-step to prevent runaway loops. */
const MAX_STEPS_PER_INVOCATION = 20

export interface AdvanceResult {
    runId: string
    stepsExecuted: number
    finalStatus: AutomationRun["status"]
    error?: string
}

/**
 * Advance a single run as far as it can go in this invocation. Stops when:
 *   - it hits a wait (run becomes "waiting", scheduledFor set)
 *   - it reaches the end (run becomes "completed")
 *   - it errors (run becomes "errored")
 *   - it has executed MAX_STEPS_PER_INVOCATION nodes (run stays "running",
 *     will be picked up on the next tick)
 */
export async function advanceRun(runId: string): Promise<AdvanceResult> {
    let run = await getRun(runId)
    if (!run) return { runId, stepsExecuted: 0, finalStatus: "errored", error: "Run not found" }

    // Race-safe transition for waiting → running. If another worker (cron retry,
    // concurrent invocation) already claimed this run, bail out immediately.
    if (run.status === "waiting") {
        const claimed = await claimWaitingRun(runId)
        if (!claimed) {
            return { runId, stepsExecuted: 0, finalStatus: "running" }
        }
        run = claimed
    }

    if (run.status !== "running") {
        return { runId, stepsExecuted: 0, finalStatus: run.status }
    }

    const automation = await getAutomation(run.workspaceId, run.automationId)
    if (!automation) {
        await updateRun(runId, {
            status: "errored",
            errorMessage: "Automation not found (deleted?)",
            completedAt: new Date(),
        })
        return { runId, stepsExecuted: 0, finalStatus: "errored", error: "Automation not found" }
    }

    if (!automation.enabled) {
        await updateRun(runId, {
            status: "stopped",
            errorMessage: "Automation disabled",
            completedAt: new Date(),
        })
        return { runId, stepsExecuted: 0, finalStatus: "stopped" }
    }

    const contact = await loadActionContact(run.contactId)

    // If the contact was deleted mid-run, fail loudly instead of silently
    // continuing with a null contact. Most actions (send_email, add_tag,
    // update_contact_field) silently no-op without a contact, which gives
    // false success. Wait/branch nodes don't need a contact, but to keep
    // run history honest we error here so admins can see what happened.
    if (run.contactId && !contact) {
        await updateRun(runId, {
            status: "errored",
            errorMessage: "Contact was deleted while this automation was running",
            completedAt: new Date(),
        })
        await bumpAutomationStat(automation.id, "runsErrored")
        return { runId, stepsExecuted: 0, finalStatus: "errored", error: "Contact deleted" }
    }

    let currentIdx = run.currentNodeIdx
    let context: Record<string, unknown> = { ...run.contextData }
    let steps = 0
    let lastError: string | undefined

    while (steps < MAX_STEPS_PER_INVOCATION) {
        const node = automation.nodes[currentIdx]
        if (!node) {
            // Walked off the end of the node list — treat as completion.
            await updateRun(runId, {
                status: "completed",
                completedAt: new Date(),
                contextData: context,
            })
            await bumpAutomationStat(automation.id, "runsCompleted")
            return { runId, stepsExecuted: steps, finalStatus: "completed" }
        }

        const ctx: ActionContext = {
            workspaceId: run.workspaceId,
            automationId: run.automationId,
            run: { ...run, currentNodeIdx: currentIdx, contextData: context },
            nodes: automation.nodes,
            contact,
        }
        const result = await runAction(node, ctx)
        steps += 1

        if (result.contextPatch) {
            context = { ...context, ...result.contextPatch }
        }

        // Soft errors (advance=true with an error string) are recorded for
        // visibility but don't stop the run — e.g. send_email skipped because
        // the recipient is suppressed.
        if (result.error && result.advance) {
            context = {
                ...context,
                lastNonFatalError: {
                    nodeId: node.id,
                    type: node.type,
                    message: result.error,
                    at: new Date().toISOString(),
                },
            }
        }

        if (result.error && !result.advance) {
            lastError = result.error
            await updateRun(runId, {
                status: "errored",
                errorMessage: lastError,
                completedAt: new Date(),
                contextData: context,
            })
            await bumpAutomationStat(automation.id, "runsErrored")
            return { runId, stepsExecuted: steps, finalStatus: "errored", error: lastError }
        }

        if (result.end) {
            await updateRun(runId, {
                status: "completed",
                completedAt: new Date(),
                contextData: context,
            })
            await bumpAutomationStat(automation.id, "runsCompleted")
            return { runId, stepsExecuted: steps, finalStatus: "completed" }
        }

        if (result.scheduledFor) {
            // Wait — pause the run, persist scheduled-for, and bail. Cron
            // picks it up later. Note: we don't advance currentNodeIdx — the
            // wait node is "in progress" until its timer fires, then the
            // engine resumes by re-entering it (which is a no-op for wait,
            // but conceptually the wait completed). To avoid that re-run we
            // advance past it now.
            await updateRun(runId, {
                status: "waiting",
                currentNodeIdx: currentIdx + 1,
                scheduledFor: result.scheduledFor,
                contextData: context,
            })
            return { runId, stepsExecuted: steps, finalStatus: "waiting" }
        }

        // Determine next index. Priority:
        //   1. Action result.jumpTo (set by branch_if)
        //   2. node.next === null  → end of path, complete
        //   3. node.next === string → jump to that nodeId
        //   4. node.next === undefined → linear fallthrough (legacy default)
        if (result.jumpTo) {
            const nextIdx = automation.nodes.findIndex((n) => n.id === result.jumpTo)
            if (nextIdx === -1) {
                lastError = `Branch target not found: ${result.jumpTo}`
                await updateRun(runId, {
                    status: "errored",
                    errorMessage: lastError,
                    completedAt: new Date(),
                    contextData: context,
                })
                await bumpAutomationStat(automation.id, "runsErrored")
                return { runId, stepsExecuted: steps, finalStatus: "errored", error: lastError }
            }
            currentIdx = nextIdx
        } else if (node.next === null) {
            // Explicit end of path
            await updateRun(runId, {
                status: "completed",
                completedAt: new Date(),
                contextData: context,
            })
            await bumpAutomationStat(automation.id, "runsCompleted")
            return { runId, stepsExecuted: steps, finalStatus: "completed" }
        } else if (typeof node.next === "string") {
            const nextIdx = automation.nodes.findIndex((n) => n.id === node.next)
            if (nextIdx === -1) {
                // Severed pointer to a deleted node — treat as end of path
                await updateRun(runId, {
                    status: "completed",
                    completedAt: new Date(),
                    contextData: context,
                })
                await bumpAutomationStat(automation.id, "runsCompleted")
                return { runId, stepsExecuted: steps, finalStatus: "completed" }
            }
            currentIdx = nextIdx
        } else {
            currentIdx += 1
        }

        // Persist progress every step so a crash mid-execution doesn't lose state
        await updateRun(runId, { currentNodeIdx: currentIdx, contextData: context })
    }

    // Hit MAX_STEPS_PER_INVOCATION without completing or waiting. Stay in
    // "running" — the cron will pick it up next tick. (Rare for normal
    // workflows; matters for branch-heavy or quickly-evaluating chains.)
    return { runId, stepsExecuted: steps, finalStatus: "running" }
}

/**
 * Cron entry point — process a batch of waiting runs whose timers have
 * elapsed. Returns a summary for logging.
 */
export interface ProcessBatchResult {
    picked: number
    advanced: number
    completed: number
    errored: number
    waiting: number
}

export async function processDueWaitingRuns(
    limit = 25,
): Promise<ProcessBatchResult> {
    const due = await findDueWaitingRuns(limit)
    let advanced = 0
    let completed = 0
    let errored = 0
    let waiting = 0

    // Sequential — keeps DB load predictable. For higher throughput later we
    // can fan out, but each run involves its own writes so concurrency
    // amplifies contention.
    for (const run of due) {
        const result = await advanceRun(run.id)
        advanced += 1
        if (result.finalStatus === "completed") completed += 1
        else if (result.finalStatus === "errored") errored += 1
        else if (result.finalStatus === "waiting") waiting += 1
    }

    return { picked: due.length, advanced, completed, errored, waiting }
}
