import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock UI primitives
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <>{children}</>,
  TooltipProvider: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
}))

vi.mock('../utils', () => ({
  getLengthOfStay: (start: string, end: string) => {
    if (!start || !end) return null
    const s = new Date(start)
    const e = new Date(end)
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  },
  formatDisplayDate: (d: string) => d ? new Date(d).toLocaleDateString() : '-',
  getAgingInfo: () => ({ label: 'New', color: 'bg-blue-500', days: 0 }),
  getPriorityColor: () => 'bg-blue-500',
}))

import { KanbanView } from '../KanbanView'

const sampleDeal = {
  id: 'deal1',
  name: 'SGT Johnson',
  email: 'johnson@army.mil',
  phone: '555-0100',
  base: 'Fort Bragg',
  stage: 'New Lead',
  value: 3500,
  margin: 875,
  priority: 'HIGH',
  startDate: '2026-05-01',
  endDate: '2026-05-30',
  pipelineStageId: 'stage1',
  contactId: 'c1',
  assignee: 'JD',
  assigneeName: 'John Doe',
  notes: 'TDY orders',
  unread: false,
  blockers: [],
  tags: [],
  requiredDocs: { lease: false, tc: false, payment: false },
  stageEnteredAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const samplePipeline = {
  id: 'p1',
  name: 'Main Pipeline',
  stages: [
    { id: 'stage1', name: 'New Lead', order: 0 },
    { id: 'stage2', name: 'Qualified', order: 1 },
  ],
  deals: [sampleDeal],
}

describe('KanbanView', () => {
  const defaultProps = {
    currentPipeline: samplePipeline,
    mobileSelectedStage: 'New Lead',
    setMobileSelectedStage: vi.fn(),
    showBase: true,
    showValue: true,
    showPriority: true,
    showDates: true,
    showEndDate: false,
    showLengthOfStay: false,
    showQuickActions: false,
    priorityRanges: { urgentDays: 7, soonDays: 14 },
    draggedDealId: null,
    dragOverStageId: null,
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn(),
    onOpenDeal: vi.fn(),
    onOpenNotes: vi.fn(),
    onCallContact: vi.fn(),
    onMessageContact: vi.fn(),
    onOpenTasks: vi.fn(),
  }

  it('renders stage column headers', () => {
    render(<KanbanView {...defaultProps} />)
    // Stage names appear in both mobile tabs and desktop columns
    expect(screen.getAllByText('New Lead').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Qualified').length).toBeGreaterThanOrEqual(1)
  })

  it('renders a deal card with the contact name', () => {
    render(<KanbanView {...defaultProps} />)
    // Name appears in both mobile and desktop views
    const matches = screen.getAllByText('SGT Johnson')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('shows deal value when showValue is true', () => {
    render(<KanbanView {...defaultProps} />)
    const text = document.body.textContent || ''
    expect(text).toMatch(/3[,.]?500/)
  })

  it('calls onOpenDeal when a deal card is clicked', () => {
    const onOpenDeal = vi.fn()
    render(<KanbanView {...defaultProps} onOpenDeal={onOpenDeal} />)
    // Find the draggable card element that contains the name
    const allDraggable = document.querySelectorAll('[draggable="true"]')
    const dealCard = Array.from(allDraggable).find(el => el.textContent?.includes('SGT Johnson'))
    expect(dealCard).toBeTruthy()
    if (dealCard) fireEvent.click(dealCard)
    expect(onOpenDeal).toHaveBeenCalledWith(expect.objectContaining({ id: 'deal1' }))
  })

  it('renders empty columns with no deal cards', () => {
    const emptyPipeline = { ...samplePipeline, deals: [] }
    render(<KanbanView {...defaultProps} currentPipeline={emptyPipeline} />)
    expect(screen.getAllByText('New Lead').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Qualified').length).toBeGreaterThanOrEqual(1)
  })

  it('marks cards as draggable', () => {
    render(<KanbanView {...defaultProps} />)
    const draggable = document.querySelector('[draggable="true"]')
    expect(draggable).toBeInTheDocument()
  })
})
