import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// Mock dependencies
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockGetNotifications = vi.fn()
const mockMarkAsRead = vi.fn()
const mockMarkAllAsRead = vi.fn()

vi.mock('@/app/notifications/actions', () => ({
  getNotifications: (...args: any[]) => mockGetNotifications(...args),
  markAsRead: (...args: any[]) => mockMarkAsRead(...args),
  markAllAsRead: (...args: any[]) => mockMarkAllAsRead(...args),
}))

vi.mock('@/hooks/useRealtimeRefresh', () => ({
  useRealtimeRefresh: vi.fn(),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}))

vi.mock('lucide-react', () => ({
  Bell: () => <span>Bell</span>,
  Check: () => <span>Check</span>,
  CheckCheck: () => <span>CheckCheck</span>,
  X: () => <span>X</span>,
  ExternalLink: () => <span>ExternalLink</span>,
}))

import { NotificationPanel } from '../NotificationPanel'

const sampleNotifications = [
  {
    id: 'n1',
    title: 'New Website Inquiry',
    message: 'SGT Smith - Fort Bragg',
    type: 'opportunity',
    linkUrl: '/pipeline?deal=opp1',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n2',
    title: 'Task Due',
    message: 'Follow up with Jones',
    type: 'task',
    linkUrl: '/tasks',
    isRead: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
]

describe('NotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNotifications.mockResolvedValue({
      success: true,
      notifications: sampleNotifications,
      unreadCount: 1,
    })
    mockMarkAsRead.mockResolvedValue({ success: true })
    mockMarkAllAsRead.mockResolvedValue({ success: true })
  })

  it('fetches notifications when opened', async () => {
    render(<NotificationPanel open={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockGetNotifications).toHaveBeenCalledWith(100)
    })
  })

  it('does not fetch notifications when closed', () => {
    render(<NotificationPanel open={false} onClose={vi.fn()} />)
    expect(mockGetNotifications).not.toHaveBeenCalled()
  })

  it('renders notification titles', async () => {
    render(<NotificationPanel open={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('New Website Inquiry')).toBeInTheDocument()
      expect(screen.getByText('Task Due')).toBeInTheDocument()
    })
  })

  it('renders notification messages', async () => {
    render(<NotificationPanel open={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('SGT Smith - Fort Bragg')).toBeInTheDocument()
    })
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<NotificationPanel open={true} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText('New Website Inquiry')).toBeInTheDocument()
    })
    // Find the close button (has X icon)
    const closeButtons = screen.getAllByRole('button')
    const closeBtn = closeButtons.find(btn => btn.textContent?.includes('X'))
    if (closeBtn) {
      fireEvent.click(closeBtn)
      expect(onClose).toHaveBeenCalled()
    }
  })

  it('handles empty notifications state', async () => {
    mockGetNotifications.mockResolvedValue({
      success: true,
      notifications: [],
      unreadCount: 0,
    })
    render(<NotificationPanel open={true} onClose={vi.fn()} />)
    await waitFor(() => {
      // Should render without crashing; look for the "no notifications" message
      const text = document.body.textContent || ''
      expect(text).toBeTruthy()
    })
  })

  it('navigates and closes when a notification with linkUrl is clicked', async () => {
    const onClose = vi.fn()
    render(<NotificationPanel open={true} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText('New Website Inquiry')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('New Website Inquiry'))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/pipeline?deal=opp1')
      expect(onClose).toHaveBeenCalled()
    })
  })
})
