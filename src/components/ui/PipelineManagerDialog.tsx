"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Trash2, GripVertical, Save, Edit2, X } from "lucide-react"
import { createPipeline, createPipelineStage, updatePipelineStage, deletePipelineStage, deletePipeline } from "@/app/pipeline/actions"
import { toast } from "sonner"

interface Stage {
    id: string
    name: string
    order: number
}

interface Pipeline {
    id: string
    name: string
    stages: Stage[]
}

interface PipelineManagerDialogProps {
    isOpen: boolean
    onClose: () => void
    pipelines: Record<string, Pipeline>
    onPipelinesChange: () => void
}

export function PipelineManagerDialog({ isOpen, onClose, pipelines, onPipelinesChange }: PipelineManagerDialogProps) {
    const pipelineList = Object.values(pipelines)
    const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
        pipelineList.length > 0 ? pipelineList[0].id : null
    )

    const [isCreatingPipeline, setIsCreatingPipeline] = useState(false)
    const [newPipelineName, setNewPipelineName] = useState("")
    const [isCreatingStage, setIsCreatingStage] = useState(false)
    const [newStageName, setNewStageName] = useState("")

    const [editingStageId, setEditingStageId] = useState<string | null>(null)
    const [editingStageName, setEditingStageName] = useState("")

    const [draggedStageId, setDraggedStageId] = useState<string | null>(null)
    const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

    const [isLoading, setIsLoading] = useState(false)

    // Reset selection when opening if current selection is invalid
    useEffect(() => {
        if (isOpen && pipelineList.length > 0 && (!selectedPipelineId || !pipelines[selectedPipelineId])) {
            setSelectedPipelineId(pipelineList[0].id)
        }
    }, [isOpen, pipelineList, selectedPipelineId, pipelines])

    const handleCreatePipeline = async () => {
        if (!newPipelineName.trim()) return
        setIsLoading(true)
        const res = await createPipeline(newPipelineName)
        if (res.success && res.pipeline) {
            toast.success(`Pipeline "${newPipelineName}" created`)
            setNewPipelineName("")
            setIsCreatingPipeline(false)
            onPipelinesChange()
            setSelectedPipelineId(res.pipeline.id)
        } else {
            toast.error("Failed to create pipeline")
        }
        setIsLoading(false)
    }

    const handleCreateStage = async () => {
        if (!newStageName.trim() || !selectedPipelineId) return
        setIsLoading(true)

        const currentPipeline = pipelines[selectedPipelineId]
        const nextOrder = currentPipeline.stages.length > 0
            ? Math.max(...currentPipeline.stages.map(s => s.order)) + 1
            : 0

        const res = await createPipelineStage(selectedPipelineId, newStageName, nextOrder)
        if (res.success) {
            toast.success(`Added "${newStageName}" stage`)
            setNewStageName("")
            setIsCreatingStage(false)
            onPipelinesChange()
        } else {
            toast.error("Failed to add stage")
        }
        setIsLoading(false)
    }

    const handleUpdateStage = async (stageId: string, currentOrder: number) => {
        if (!editingStageName.trim()) return
        setIsLoading(true)
        const res = await updatePipelineStage(stageId, editingStageName, currentOrder)
        if (res.success) {
            toast.success("Stage renamed")
            setEditingStageId(null)
            onPipelinesChange()
        } else {
            toast.error("Failed to rename stage")
        }
        setIsLoading(false)
    }

    const handleDeleteStage = async (stageId: string) => {
        if (!confirm("Are you sure you want to delete this stage? Opportunities in this stage may be orphaned.")) return
        setIsLoading(true)
        const res = await deletePipelineStage(stageId)
        if (res.success) {
            toast.success("Stage deleted")
            onPipelinesChange()
        } else {
            toast.error("Failed to delete stage")
        }
        setIsLoading(false)
    }

    const handleDeletePipeline = async (pipelineId: string) => {
        if (!confirm("Are you absolutely sure you want to delete this pipeline AND all of its stages and opportunities? This action cannot be undone.")) return
        setIsLoading(true)
        const res = await deletePipeline(pipelineId)
        if (res.success) {
            toast.success("Pipeline deleted")
            setSelectedPipelineId(null)
            onPipelinesChange()
        } else {
            toast.error("Failed to delete pipeline")
        }
        setIsLoading(false)
    }

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedStageId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault(); // Necessary to allow drop
        setDragOverStageId(id);
    };

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        setDragOverStageId(null);
        if (!draggedStageId || draggedStageId === targetId || !selectedPipelineId) return;

        const currentPipeline = pipelines[selectedPipelineId];
        if (!currentPipeline) return;

        // Sort array by existing order
        const sortedStages = [...currentPipeline.stages].sort((a, b) => a.order - b.order);

        const draggedIdx = sortedStages.findIndex(s => s.id === draggedStageId);
        const targetIdx = sortedStages.findIndex(s => s.id === targetId);

        if (draggedIdx === -1 || targetIdx === -1) return;

        // Remove dragged item
        const [draggedItem] = sortedStages.splice(draggedIdx, 1);
        // Insert at target index
        sortedStages.splice(targetIdx, 0, draggedItem);

        setIsLoading(true);
        // Persist new orders
        await Promise.all(sortedStages.map((stage, index) =>
            updatePipelineStage(stage.id, stage.name, index)
        ));
        onPipelinesChange();
        setIsLoading(false);
        setDraggedStageId(null);
    };

    const currentPipeline = selectedPipelineId ? pipelines[selectedPipelineId] : null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[700px] border-white/10 bg-background/95 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Manage Pipelines</DialogTitle>
                    <DialogDescription>
                        Create new pipelines or manage stages for existing ones.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-6 mt-4 h-[400px]">
                    {/* Left Sidebar: Pipeline List */}
                    <div className="w-1/3 border-r border-white/10 pr-4 flex flex-col gap-2 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold tracking-tight text-muted-foreground uppercase">Pipelines</h3>
                            {!isCreatingPipeline && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setIsCreatingPipeline(true)}>
                                    <Plus className="h-3 w-3" />
                                </Button>
                            )}
                        </div>

                        {isCreatingPipeline && (
                            <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg border border-white/5 mb-2">
                                <Input
                                    size={1}
                                    className="h-8 text-sm"
                                    placeholder="Pipeline name"
                                    value={newPipelineName}
                                    onChange={(e) => setNewPipelineName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePipeline()}
                                />
                                <div className="flex gap-2">
                                    <Button size="sm" className="h-7 flex-1 text-xs" onClick={handleCreatePipeline} disabled={isLoading || !newPipelineName.trim()}>Save</Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setIsCreatingPipeline(false); setNewPipelineName(""); }}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            {pipelineList.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPipelineId(p.id)}
                                    className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedPipelineId === p.id ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted/50 text-muted-foreground'}`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Area: Stages for Selected Pipeline */}
                    <div className="flex-1 flex flex-col overflow-hidden pl-2">
                        {currentPipeline ? (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold">{currentPipeline.name} Stages</h3>
                                        <p className="text-xs text-muted-foreground">{currentPipeline.stages.length} stages defined</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10" onClick={() => handleDeletePipeline(currentPipeline.id)} disabled={isLoading}>
                                            <Trash2 className="h-3.5 w-3.5" /> Delete Pipeline
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setIsCreatingStage(true)} disabled={isLoading}>
                                            <Plus className="h-3.5 w-3.5" /> Next Stage
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                    {currentPipeline.stages.sort((a, b) => a.order - b.order).map(stage => (
                                        <div
                                            key={stage.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, stage.id)}
                                            onDragOver={(e) => handleDragOver(e, stage.id)}
                                            onDrop={(e) => handleDrop(e, stage.id)}
                                            onDragEnd={() => { setDraggedStageId(null); setDragOverStageId(null); }}
                                            className={`flex items-center gap-3 bg-muted/20 border p-3 rounded-lg group transition-all ${dragOverStageId === stage.id ? "border-primary border-dashed opacity-50 bg-primary/5" : "border-white/5"} ${draggedStageId === stage.id ? "opacity-30" : ""}`}
                                        >
                                            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />

                                            {editingStageId === stage.id ? (
                                                <div className="flex-1 flex items-center gap-2">
                                                    <Input
                                                        className="h-8 text-sm"
                                                        value={editingStageName}
                                                        onChange={(e) => setEditingStageName(e.target.value)}
                                                        autoFocus
                                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateStage(stage.id, stage.order)}
                                                    />
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400" onClick={() => handleUpdateStage(stage.id, stage.order)} disabled={isLoading || !editingStageName.trim()}>
                                                        <Save className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingStageId(null)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex-1 font-medium text-sm">
                                                        {stage.name}
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                                            setEditingStageId(stage.id);
                                                            setEditingStageName(stage.name);
                                                        }}>
                                                            <Edit2 className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500 hover:text-rose-400" onClick={() => handleDeleteStage(stage.id)} disabled={isLoading}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}

                                    {isCreatingStage && (
                                        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 p-3 rounded-lg">
                                            <div className="h-4 w-4" /> {/* Spacer for grip */}
                                            <Input
                                                className="h-8 text-sm flex-1"
                                                placeholder="New stage name..."
                                                value={newStageName}
                                                onChange={(e) => setNewStageName(e.target.value)}
                                                autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && handleCreateStage()}
                                            />
                                            <Button size="sm" className="h-8 text-xs" onClick={handleCreateStage} disabled={isLoading || !newStageName.trim()}>Add</Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setIsCreatingStage(false); setNewStageName(""); }}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}

                                    {currentPipeline.stages.length === 0 && !isCreatingStage && (
                                        <div className="text-center p-8 text-muted-foreground text-sm border-2 border-dashed border-white/5 rounded-xl">
                                            No stages defined for this pipeline.
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                                Select a pipeline to manage its stages
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
