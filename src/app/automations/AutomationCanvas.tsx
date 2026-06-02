"use client"

/**
 * Visual canvas view for an automation.
 *
 * v4 capabilities:
 *   - Nodes draggable; position persists via parent's onChange
 *   - branch_if true/false handles support drag-to-connect (sets trueNext / falseNext)
 *   - Non-branch nodes' bottom handle now connectable too — drag to wire up
 *     an explicit `next` pointer (severs the implicit linear fallthrough)
 *   - Right-click any edge → context menu with "Disconnect" (sets the
 *     source's pointer to null = explicit end-of-path)
 *   - Right-click any node → "Delete step"
 *   - Drag a node onto the trash zone → delete
 *   - Delete / Backspace key when a node is selected → delete
 *   - "Clean up" button auto-lays out nodes by walking the graph
 *
 * The data model:
 *   node.next === undefined → fall through to next-in-array (legacy default)
 *   node.next === string    → explicit jump to this nodeId (real edge drawn)
 *   node.next === null      → severed end-of-path (no edge drawn)
 *   branch_if uses trueNext/falseNext with the same three states.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    Position,
    ReactFlow,
    type Connection,
    type Edge,
    type Node,
    type NodeChange,
    type NodeProps,
    useEdgesState,
    useNodesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { LayoutGrid, Plus, Trash2, Unlink, Zap, CheckCircle2, AlertCircle } from "lucide-react"
import type { AutomationNode } from "@/lib/automations/types"

interface CanvasProps {
    nodes: AutomationNode[]
    selectedNodeId: string | null
    onSelectNode: (id: string | null) => void
    onAddNodeRequest: () => void
    onUpdateNode: (id: string, patch: Partial<AutomationNode>) => void
    onRemoveNode: (id: string) => void
    triggerLabel: string
    /** Whether the automation is currently enabled — drives the "Listening" pulse + canvas tint. */
    isLive?: boolean
    actionMeta: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }>
}

interface FlowNodeData extends Record<string, unknown> {
    label: string
    /** Short summary of the node's config — shown small under the label. */
    preview: string
    step: number
    iconKey: string
    type: AutomationNode["type"]
    selected: boolean
    isBranch: boolean
    /** True when the node has no required config filled in yet. */
    needsSetup: boolean
    nodeId: string
}

const nodeTypes = {
    triggerNode: TriggerNode,
    actionNode: ActionNode,
    addNode: AddNode,
}

function TriggerNode({ data }: NodeProps<Node<{ label: string; isLive: boolean }>>) {
    return (
        <div className="rounded-lg border-l-4 border-l-primary bg-card shadow-sm px-3 py-2 min-w-[240px] relative">
            <div className="flex items-center gap-2">
                <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Zap className="w-3 h-3" />
                    </div>
                    {data.isLive && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[9px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
                        Trigger
                        {data.isLive && (
                            <span className="text-emerald-600 normal-case font-medium tracking-normal">
                                · Listening
                            </span>
                        )}
                    </div>
                    <div className="text-xs font-medium truncate">{data.label}</div>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
        </div>
    )
}

function ActionNode({ data }: NodeProps<Node<FlowNodeData>>) {
    const Icon = ACTION_ICON_REGISTRY[data.iconKey] ?? Plus
    return (
        <div
            className={`rounded-lg border bg-card shadow-sm min-w-[240px] max-w-[260px] cursor-pointer transition-shadow ${
                data.selected
                    ? "border-primary ring-2 ring-primary/30"
                    : "hover:shadow-md hover:border-primary/40"
            } ${data.needsSetup ? "border-amber-500/60 bg-amber-500/[0.03]" : ""}`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-muted-foreground !w-3 !h-3"
            />
            <div className="px-3 py-2">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground tabular-nums shrink-0">
                        {data.step}
                    </div>
                    <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-medium truncate flex-1">{data.label}</span>
                    {data.needsSetup ? (
                        <span
                            className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0"
                            title="Needs setup"
                        >
                            <AlertCircle className="w-2.5 h-2.5" />
                            Setup
                        </span>
                    ) : (
                        <CheckCircle2
                            className="w-3.5 h-3.5 text-emerald-500 shrink-0"
                            aria-label="Configured"
                        />
                    )}
                </div>
                {data.preview && (
                    <div className="mt-1 pl-8 text-[10px] text-muted-foreground/80 leading-snug truncate">
                        {data.preview}
                    </div>
                )}
            </div>
            {data.isBranch ? (
                <>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        style={{ left: "30%" }}
                        className="!bg-emerald-500 !w-3 !h-3"
                    />
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        style={{ left: "70%" }}
                        className="!bg-red-500 !w-3 !h-3"
                    />
                </>
            ) : (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!bg-muted-foreground !w-3 !h-3"
                />
            )}
        </div>
    )
}

function AddNode({ data }: NodeProps<Node<{ onAdd: () => void; isFirst: boolean }>>) {
    if (data.isFirst) {
        return (
            <div
                onClick={data.onAdd}
                className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 px-5 py-4 min-w-[240px] cursor-pointer text-center transition-colors flex flex-col items-center justify-center gap-1"
            >
                <Handle type="target" position={Position.Top} className="!opacity-0" />
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Plus className="w-3.5 h-3.5" />
                    Add your first step
                </div>
                <div className="text-[10px] text-muted-foreground">
                    Choose what happens when the trigger fires
                </div>
            </div>
        )
    }
    return (
        <div
            onClick={data.onAdd}
            className="rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/40 hover:bg-muted/30 px-4 py-3 min-w-[220px] cursor-pointer text-center transition-colors text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
        >
            <Handle type="target" position={Position.Top} className="!opacity-0" />
            <Plus className="w-3.5 h-3.5" />
            Add step
        </div>
    )
}

const ACTION_ICON_REGISTRY: Record<string, React.ComponentType<{ className?: string }>> = {}

const AUTO_LAYOUT_X = 0
const AUTO_LAYOUT_Y_STEP = 130
const BRANCH_X_OFFSET = 280

function positionFor(node: AutomationNode, idx: number): { x: number; y: number } {
    return node.position ?? { x: AUTO_LAYOUT_X, y: (idx + 1) * AUTO_LAYOUT_Y_STEP }
}

/** Short single-line summary of a node's config — shown under the label. */
function previewFor(node: AutomationNode): string {
    switch (node.type) {
        case "send_email":
            return node.subject || "(no subject yet)"
        case "ai_send_email":
            return node.subject || "(no subject yet)"
        case "ai_classify":
            return node.options?.length
                ? `Pick from: ${node.options.slice(0, 3).join(", ")}${node.options.length > 3 ? "…" : ""}`
                : "(no options yet)"
        case "ai_score":
            return node.prompt
                ? node.prompt.length > 60 ? node.prompt.slice(0, 60) + "…" : node.prompt
                : "0–100 score"
        case "ai_summarize":
            return node.sourceText
                ? `From: ${node.sourceText.length > 50 ? node.sourceText.slice(0, 50) + "…" : node.sourceText}`
                : "Summarize contact context"
        case "send_sms":
            return node.body
                ? node.body.length > 60
                    ? node.body.slice(0, 60) + "…"
                    : node.body
                : "(empty message)"
        case "wait":
            return formatMinutes(node.delayMinutes)
        case "wait_until":
            return node.until ? `Until ${formatDateShort(node.until)}` : ""
        case "wait_until_business_hours": {
            const tz = node.timezone || "UTC"
            const start = node.startHour ?? 9
            const end = node.endHour ?? 17
            return `${start}:00–${end}:00 ${tz.split("/").pop()}`
        }
        case "branch_if":
        case "stop_if":
            return summarizeCondition(node.condition)
        case "add_tag":
        case "remove_tag":
            return node.tagId ? `Tag: ${node.tagId}` : "(no tag picked)"
        case "add_to_list":
        case "remove_from_list":
            return node.listId ? `List: ${node.listId.slice(0, 8)}…` : "(no list picked)"
        case "update_contact_field":
        case "update_opportunity":
            return node.fieldPath
                ? `${node.fieldPath} = ${formatVal(node.value)}`
                : "(no field set)"
        case "move_opportunity_to_stage":
            if (!node.stageId) return "(no stage picked)"
            if (node.stageName) {
                return node.pipelineName ? `→ ${node.pipelineName} · ${node.stageName}` : `→ ${node.stageName}`
            }
            return `→ stage ${node.stageId.slice(0, 8)}…`
        case "increment_field":
            return node.fieldPath
                ? `${node.fieldPath} += ${node.delta ?? 0}`
                : "(no field set)"
        case "assign_user":
            return node.userId ? `Assign user: ${node.userId.slice(0, 8)}…` : "Unassign"
        case "create_task":
            return node.title || "(no title)"
        case "send_internal_email":
            return node.to || "(no recipient)"
        case "webhook":
            return node.url ? truncate(node.url, 50) : "(no URL set)"
        case "end":
            return "Stops here"
    }
}

/** Heuristic: should this node be flagged "needs setup" with an amber dot? */
export function nodeNeedsSetup(node: AutomationNode): boolean {
    switch (node.type) {
        case "send_email":
            return !node.subject?.trim() || !node.html?.trim()
        case "ai_send_email":
            return !node.subject?.trim() || !node.prompt?.trim()
        case "ai_classify":
            return !node.prompt?.trim() || !Array.isArray(node.options) || node.options.length === 0
        case "ai_score":
            return !node.prompt?.trim()
        case "ai_summarize":
            return false // Empty source defaults to "summarize the contact"
        case "send_sms":
            return !node.body?.trim()
        case "wait":
            return !node.delayMinutes || node.delayMinutes < 1
        case "wait_until":
            return !node.until
        case "branch_if":
        case "stop_if":
            return !node.condition?.targetId
        case "add_tag":
        case "remove_tag":
            return !node.tagId
        case "add_to_list":
        case "remove_from_list":
            return !node.listId
        case "update_contact_field":
        case "update_opportunity":
        case "increment_field":
            return !node.fieldPath?.trim()
        case "move_opportunity_to_stage":
            return !node.stageId?.trim()
        case "assign_user":
            return false // unassign is a valid op
        case "create_task":
            return !node.title?.trim()
        case "send_internal_email":
            return !node.to?.trim()
        case "webhook":
            return !node.url?.trim()
        default:
            return false
    }
}

function formatMinutes(min: number): string {
    if (!min || min < 1) return "(no duration)"
    if (min < 60) return `Wait ${min} min`
    const hours = min / 60
    if (hours < 24) {
        return `Wait ${hours % 1 === 0 ? hours : hours.toFixed(1)} hr${hours === 1 ? "" : "s"}`
    }
    const days = hours / 24
    return `Wait ${days % 1 === 0 ? days : days.toFixed(1)} day${days === 1 ? "" : "s"}`
}

function formatDateShort(iso: string): string {
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(iso))
    } catch {
        return iso
    }
}

function summarizeCondition(c: { field: string; targetId: string } | undefined): string {
    if (!c) return ""
    if (!c.targetId) return `(no ${c.field})`
    const id = c.targetId.length > 8 ? c.targetId.slice(0, 8) + "…" : c.targetId
    return `${c.field}: ${id}`
}

function formatVal(v: unknown): string {
    if (v === null || v === undefined) return "—"
    return String(v).slice(0, 30)
}

function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + "…" : s
}

interface ContextMenu {
    type: "node"
    nodeId: string
    x: number
    y: number
}
interface EdgeContextMenu {
    type: "edge"
    edgeKind: "next" | "true" | "false"
    sourceNodeId: string
    x: number
    y: number
}
type AnyMenu = ContextMenu | EdgeContextMenu

/**
 * Compute auto-layout positions by walking the graph from the trigger.
 * BFS — at each branch, true path goes left, false path goes right.
 */
function computeAutoLayout(nodes: AutomationNode[]): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>()
    if (nodes.length === 0) return positions

    const linearNextOf = (idx: number): string | null => {
        return idx + 1 < nodes.length ? nodes[idx + 1].id : null
    }
    const idxOf = (nodeId: string): number => nodes.findIndex((n) => n.id === nodeId)

    interface Visit { nodeId: string; x: number; y: number }
    const queue: Visit[] = [{ nodeId: nodes[0].id, x: 0, y: AUTO_LAYOUT_Y_STEP }]
    const visited = new Set<string>()

    while (queue.length > 0) {
        const { nodeId, x, y } = queue.shift()!
        if (visited.has(nodeId)) continue
        visited.add(nodeId)
        positions.set(nodeId, { x, y })

        const idx = idxOf(nodeId)
        if (idx === -1) continue
        const node = nodes[idx]

        if (node.type === "branch_if") {
            const tNext =
                node.trueNext === null
                    ? null
                    : (node.trueNext as string | undefined) ?? linearNextOf(idx)
            const fNext =
                node.falseNext === null
                    ? null
                    : (node.falseNext as string | undefined) ?? linearNextOf(idx)
            if (tNext && !visited.has(tNext)) {
                queue.push({ nodeId: tNext, x: x - BRANCH_X_OFFSET, y: y + AUTO_LAYOUT_Y_STEP })
            }
            if (fNext && !visited.has(fNext)) {
                queue.push({ nodeId: fNext, x: x + BRANCH_X_OFFSET, y: y + AUTO_LAYOUT_Y_STEP })
            }
        } else {
            const next =
                node.next === null
                    ? null
                    : (node.next as string | undefined) ?? linearNextOf(idx)
            if (next && !visited.has(next)) {
                queue.push({ nodeId: next, x, y: y + AUTO_LAYOUT_Y_STEP })
            }
        }
    }

    // Orphans (not reachable from trigger) — stack at the bottom
    let maxY = AUTO_LAYOUT_Y_STEP
    positions.forEach((p) => {
        if (p.y > maxY) maxY = p.y
    })
    let orphanX = 0
    nodes.forEach((n) => {
        if (!positions.has(n.id)) {
            positions.set(n.id, { x: orphanX, y: maxY + AUTO_LAYOUT_Y_STEP })
            orphanX += BRANCH_X_OFFSET
        }
    })

    return positions
}

export function AutomationCanvas({
    nodes,
    selectedNodeId,
    onSelectNode,
    onAddNodeRequest,
    onUpdateNode,
    onRemoveNode,
    triggerLabel,
    isLive = false,
    actionMeta,
}: CanvasProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const trashRef = useRef<HTMLDivElement | null>(null)
    const [menu, setMenu] = useState<AnyMenu | null>(null)
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [trashHover, setTrashHover] = useState(false)

    Object.entries(actionMeta).forEach(([k, m]) => {
        ACTION_ICON_REGISTRY[k] = m.Icon
    })

    const flowNodes = useMemo<Node[]>(() => {
        const out: Node[] = []
        out.push({
            id: "__trigger",
            type: "triggerNode",
            position: { x: 0, y: 0 },
            data: { label: triggerLabel, isLive },
            draggable: false,
            selectable: false,
        })

        let maxY = 0
        nodes.forEach((n, idx) => {
            const pos = positionFor(n, idx)
            if (pos.y > maxY) maxY = pos.y
            out.push({
                id: n.id,
                type: "actionNode",
                position: pos,
                data: {
                    label: actionMeta[n.type]?.label ?? n.type,
                    preview: previewFor(n),
                    step: idx + 1,
                    iconKey: n.type,
                    type: n.type,
                    selected: n.id === selectedNodeId,
                    isBranch: n.type === "branch_if",
                    needsSetup: nodeNeedsSetup(n),
                    nodeId: n.id,
                } as FlowNodeData,
                draggable: true,
            })
        })

        out.push({
            id: "__add",
            type: "addNode",
            position: {
                x: 0,
                y: nodes.length === 0 ? AUTO_LAYOUT_Y_STEP : maxY + AUTO_LAYOUT_Y_STEP,
            },
            data: { onAdd: onAddNodeRequest, isFirst: nodes.length === 0 },
            draggable: false,
            selectable: false,
        })
        return out
    }, [nodes, selectedNodeId, triggerLabel, isLive, actionMeta, onAddNodeRequest])

    const flowEdges = useMemo<Edge[]>(() => {
        const out: Edge[] = []
        if (nodes.length > 0) {
            out.push({
                id: "e-trigger",
                source: "__trigger",
                target: nodes[0].id,
                type: "smoothstep",
            })
        } else {
            out.push({
                id: "e-trigger-add",
                source: "__trigger",
                target: "__add",
                type: "smoothstep",
            })
        }

        const linearNextOf = (i: number): string | null =>
            i + 1 < nodes.length ? nodes[i + 1].id : null

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]

            if (node.type === "branch_if") {
                // True branch
                pushBranchEdge(out, node, "true", node.trueNext, linearNextOf(i), nodes)
                // False branch
                pushBranchEdge(out, node, "false", node.falseNext, linearNextOf(i), nodes)
            } else {
                // Regular node — explicit `next` overrides linear fallthrough
                const explicit = node.next
                let targetId: string | null
                let isFallthrough = false
                if (explicit === null) {
                    targetId = null
                } else if (typeof explicit === "string") {
                    targetId = nodes.find((n) => n.id === explicit) ? explicit : null
                } else {
                    // undefined — linear fallthrough to next in array, or to add-button
                    targetId = linearNextOf(i) ?? "__add"
                    isFallthrough = true
                }
                if (targetId) {
                    out.push({
                        id: `e-${node.id}-next`,
                        source: node.id,
                        target: targetId,
                        type: "smoothstep",
                        ...(isFallthrough
                            ? { style: { stroke: "#94a3b8", strokeDasharray: "4 4" } }
                            : { style: { stroke: "#64748b" } }),
                    })
                }
            }
        }

        return out
    }, [nodes])

    const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState(flowNodes)
    const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState(flowEdges)

    useEffect(() => {
        setRfNodes(flowNodes)
    }, [flowNodes, setRfNodes])
    useEffect(() => {
        setRfEdges(flowEdges)
    }, [flowEdges, setRfEdges])

    const handleNodesChange = useCallback(
        (changes: NodeChange[]) => {
            onRfNodesChange(changes)
            for (const c of changes) {
                if (c.type === "position" && c.dragging === false && c.position) {
                    if (c.id === "__trigger" || c.id === "__add") continue
                    onUpdateNode(c.id, {
                        position: { x: c.position.x, y: c.position.y },
                    })
                }
                if (c.type === "position") {
                    if (c.dragging) setDraggingId(c.id)
                    else setDraggingId(null)
                }
            }
        },
        [onRfNodesChange, onUpdateNode],
    )

    const handleNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            if (node.id === "__trigger" || node.id === "__add") return
            setMenu(null)
            onSelectNode(node.id)
        },
        [onSelectNode],
    )

    const handleNodeContextMenu = useCallback(
        (event: React.MouseEvent, node: Node) => {
            event.preventDefault()
            if (node.id === "__trigger" || node.id === "__add") return
            const rect = containerRef.current?.getBoundingClientRect()
            const x = rect ? event.clientX - rect.left : event.clientX
            const y = rect ? event.clientY - rect.top : event.clientY
            setMenu({ type: "node", nodeId: node.id, x, y })
            onSelectNode(node.id)
        },
        [onSelectNode],
    )

    const handleEdgeContextMenu = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
            event.preventDefault()
            // Only edges originating from a real action node are severable
            if (edge.source === "__trigger") return
            const rect = containerRef.current?.getBoundingClientRect()
            const x = rect ? event.clientX - rect.left : event.clientX
            const y = rect ? event.clientY - rect.top : event.clientY
            // Determine which kind of edge this is from the id pattern
            let kind: "next" | "true" | "false" = "next"
            if (edge.id.endsWith("-true") || edge.id.endsWith("-true-next")) kind = "true"
            else if (edge.id.endsWith("-false") || edge.id.endsWith("-false-next")) kind = "false"
            setMenu({ type: "edge", edgeKind: kind, sourceNodeId: edge.source, x, y })
        },
        [],
    )

    const handleConnect = useCallback(
        (conn: Connection) => {
            if (!conn.source || !conn.target) return
            if (conn.source === "__trigger" || conn.target === "__add") return
            if (conn.target === "__trigger") return
            if (conn.sourceHandle === "true") {
                onUpdateNode(conn.source, {
                    trueNext: conn.target,
                } as Partial<AutomationNode>)
            } else if (conn.sourceHandle === "false") {
                onUpdateNode(conn.source, {
                    falseNext: conn.target,
                } as Partial<AutomationNode>)
            } else {
                // Regular node — set explicit next pointer
                onUpdateNode(conn.source, {
                    next: conn.target,
                } as Partial<AutomationNode>)
            }
        },
        [onUpdateNode],
    )

    // Disconnect an edge (sets the source's pointer to null)
    const disconnectEdge = useCallback(
        (sourceNodeId: string, kind: "next" | "true" | "false") => {
            if (kind === "true") {
                onUpdateNode(sourceNodeId, {
                    trueNext: null,
                } as unknown as Partial<AutomationNode>)
            } else if (kind === "false") {
                onUpdateNode(sourceNodeId, {
                    falseNext: null,
                } as unknown as Partial<AutomationNode>)
            } else {
                onUpdateNode(sourceNodeId, {
                    next: null,
                } as unknown as Partial<AutomationNode>)
            }
        },
        [onUpdateNode],
    )

    const handleNodeDrag = useCallback(
        (event: React.MouseEvent) => {
            if (!draggingId) return
            const trash = trashRef.current?.getBoundingClientRect()
            if (!trash) return
            const overTrash =
                event.clientX >= trash.left &&
                event.clientX <= trash.right &&
                event.clientY >= trash.top &&
                event.clientY <= trash.bottom
            setTrashHover(overTrash)
        },
        [draggingId],
    )

    const handleNodeDragStop = useCallback(
        (event: React.MouseEvent, node: Node) => {
            const trash = trashRef.current?.getBoundingClientRect()
            if (!trash) {
                setTrashHover(false)
                setDraggingId(null)
                return
            }
            const overTrash =
                event.clientX >= trash.left &&
                event.clientX <= trash.right &&
                event.clientY >= trash.top &&
                event.clientY <= trash.bottom
            if (overTrash && node.id !== "__trigger" && node.id !== "__add") {
                onRemoveNode(node.id)
                if (selectedNodeId === node.id) onSelectNode(null)
            }
            setTrashHover(false)
            setDraggingId(null)
        },
        [onRemoveNode, onSelectNode, selectedNodeId],
    )

    // Keyboard delete
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Delete" && e.key !== "Backspace") return
            const tag = (e.target as HTMLElement | null)?.tagName
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
            if (selectedNodeId) {
                e.preventDefault()
                onRemoveNode(selectedNodeId)
                onSelectNode(null)
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [selectedNodeId, onRemoveNode, onSelectNode])

    // Clean up: walk graph, set all node positions
    const cleanUpLayout = useCallback(() => {
        const positions = computeAutoLayout(nodes)
        positions.forEach((pos, nodeId) => {
            onUpdateNode(nodeId, { position: pos })
        })
    }, [nodes, onUpdateNode])

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative"
            onMouseMove={handleNodeDrag}
            onClick={() => setMenu(null)}
        >
            <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onRfEdgesChange}
                onNodeClick={handleNodeClick}
                onNodeContextMenu={handleNodeContextMenu}
                onEdgeContextMenu={handleEdgeContextMenu}
                onPaneClick={() => {
                    onSelectNode(null)
                    setMenu(null)
                }}
                onConnect={handleConnect}
                onNodeDragStop={handleNodeDragStop}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
                minZoom={0.3}
                maxZoom={1.5}
                proOptions={{ hideAttribution: true }}
            >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                <Controls showInteractive={false} />
            </ReactFlow>

            {/* Top-right toolbar — Clean Up + status pill */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                <div
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium shadow-sm border flex items-center gap-1.5 ${
                        isLive
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400"
                            : "bg-muted border-border text-muted-foreground"
                    }`}
                    title={isLive ? "This automation is live and enrolling contacts" : "This automation is paused — turn it on to enroll contacts"}
                >
                    {isLive ? (
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                    ) : (
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                    )}
                    {isLive ? "Live" : "Paused"}
                </div>
                <button
                    type="button"
                    onClick={cleanUpLayout}
                    className="bg-card border rounded-md px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted/50 hover:border-primary/40 transition-colors flex items-center gap-1.5"
                    title="Auto-arrange nodes by walking the graph from the trigger"
                >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Clean up
                </button>
            </div>

            {/* Trash drop zone */}
            <div
                ref={trashRef}
                className={`absolute bottom-4 right-4 w-14 h-14 rounded-full border-2 flex items-center justify-center shadow-md transition-all z-10 pointer-events-none ${
                    trashHover
                        ? "bg-destructive border-destructive scale-110 ring-4 ring-destructive/30"
                        : draggingId
                          ? "bg-card border-destructive/50 border-dashed"
                          : "bg-card/80 border-muted-foreground/30 opacity-50"
                }`}
                title="Drag a step here to delete"
            >
                <Trash2
                    className={`w-5 h-5 transition-colors ${
                        trashHover ? "text-white" : "text-muted-foreground"
                    }`}
                />
            </div>

            {/* Bottom-left help hints — keeps newcomers oriented */}
            <div className="absolute bottom-4 left-4 z-10 text-[10px] text-muted-foreground/80 bg-card/70 backdrop-blur-sm border rounded-md px-2.5 py-1.5 shadow-sm pointer-events-none flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                    <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">drag</kbd>
                    <span>connect handles to wire steps</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">right-click</kbd>
                    <span>delete or disconnect</span>
                </div>
            </div>

            {/* Context menu (node or edge) */}
            {menu && (
                <div
                    className="absolute z-50 min-w-[160px] rounded-md bg-popover border shadow-lg py-1"
                    style={{ left: menu.x, top: menu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {menu.type === "node" ? (
                        <button
                            type="button"
                            onClick={() => {
                                onRemoveNode(menu.nodeId)
                                if (selectedNodeId === menu.nodeId) onSelectNode(null)
                                setMenu(null)
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete step
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                disconnectEdge(menu.sourceNodeId, menu.edgeKind)
                                setMenu(null)
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                        >
                            <Unlink className="w-3.5 h-3.5" />
                            Disconnect{" "}
                            {menu.edgeKind === "true"
                                ? "TRUE branch"
                                : menu.edgeKind === "false"
                                  ? "FALSE branch"
                                  : "next"}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

// Helper: push a single branch edge (true or false) into the edges array
function pushBranchEdge(
    out: Edge[],
    node: AutomationNode,
    kind: "true" | "false",
    explicit: string | null | undefined,
    linearFallback: string | null,
    allNodes: AutomationNode[],
): void {
    if (node.type !== "branch_if") return
    const colorByKind = kind === "true" ? "#16a34a" : "#dc2626"
    const labelByKind = kind === "true" ? "Yes" : "No"
    const handleId = kind

    let targetId: string | null
    let isFallthrough = false
    if (explicit === null) {
        // Severed — no edge
        return
    } else if (typeof explicit === "string") {
        targetId = allNodes.find((n) => n.id === explicit) ? explicit : null
    } else {
        // undefined — linear fallthrough
        targetId = linearFallback
        isFallthrough = true
    }
    if (!targetId) return

    out.push({
        id: `e-${node.id}-${kind}${isFallthrough ? "-next" : ""}`,
        source: node.id,
        sourceHandle: handleId,
        target: targetId,
        type: "smoothstep",
        // Only show the Yes/No label when explicitly wired. Fallthrough edges
        // stay clean — color hints which path it is, no noisy text.
        label: isFallthrough ? undefined : labelByKind,
        labelStyle: isFallthrough
            ? undefined
            : { fontSize: 10, fontWeight: 600, fill: colorByKind },
        labelBgStyle: isFallthrough
            ? undefined
            : { fill: "#ffffff" },
        labelBgPadding: isFallthrough ? undefined : [4, 6],
        labelBgBorderRadius: isFallthrough ? undefined : 4,
        style: {
            stroke: colorByKind,
            strokeWidth: isFallthrough ? 1 : 2,
            ...(isFallthrough ? { opacity: 0.5 } : {}),
        },
    })
}
