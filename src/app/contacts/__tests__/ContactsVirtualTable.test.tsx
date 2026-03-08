import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock the UI components that ContactsVirtualTable depends on
vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
  TableHead: ({ children, ...props }: any) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: any) => <div data-testid="avatar" {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props: any) => (
    <input
      type="checkbox"
      checked={props.checked}
      onChange={() => props.onCheckedChange?.()}
      aria-label={props['aria-label']}
      data-testid="checkbox"
    />
  ),
}))

// Import after mocks
import { ContactsVirtualTable } from '../ContactsVirtualTable'

const defaultColumns = [
  { id: 'name' as const, label: 'Name', visible: true, width: 200 },
  { id: 'email' as const, label: 'Email', visible: true, width: 200 },
  { id: 'phone' as const, label: 'Phone', visible: true, width: 150 },
  { id: 'status' as const, label: 'Status', visible: true, width: 120 },
]

const sampleContacts = [
  {
    id: 'c1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-1111',
    status: 'Lead',
    createdAt: new Date().toISOString(),
    opportunities: [],
    tags: [],
  },
  {
    id: 'c2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '555-2222',
    status: 'Active',
    createdAt: '2020-01-01T00:00:00Z',
    opportunities: [],
    tags: [],
  },
]

describe('ContactsVirtualTable', () => {
  const defaultProps = {
    contacts: sampleContacts,
    columns: defaultColumns,
    selectedContactIds: new Set<string>(),
    resizingCol: null,
    onToggleSelectAll: vi.fn(),
    onToggleSelectContact: vi.fn(),
    onSelectContact: vi.fn(),
    onResizeStart: vi.fn(),
  }

  it('renders contact names', () => {
    render(<ContactsVirtualTable {...defaultProps} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('renders column headers', () => {
    render(<ContactsVirtualTable {...defaultProps} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('renders empty state when no contacts', () => {
    render(<ContactsVirtualTable {...defaultProps} contacts={[]} />)
    // Should not crash and should render table structure
    const table = document.querySelector('table')
    expect(table).toBeInTheDocument()
  })

  it('calls onSelectContact when a row is clicked', () => {
    const onSelectContact = vi.fn()
    render(<ContactsVirtualTable {...defaultProps} onSelectContact={onSelectContact} />)
    const row = screen.getByText('John Doe').closest('tr')
    if (row) fireEvent.click(row)
    expect(onSelectContact).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }))
  })

  it('calls onToggleSelectContact when checkbox is clicked', () => {
    const onToggleSelectContact = vi.fn()
    render(<ContactsVirtualTable {...defaultProps} onToggleSelectContact={onToggleSelectContact} />)
    const checkboxes = screen.getAllByTestId('checkbox')
    // First checkbox after the header select-all
    if (checkboxes.length > 1) {
      fireEvent.click(checkboxes[1])
      expect(onToggleSelectContact).toHaveBeenCalled()
    }
  })

  it('shows selected state for selected contacts', () => {
    const selected = new Set(['c1'])
    render(<ContactsVirtualTable {...defaultProps} selectedContactIds={selected} />)
    const checkboxes = screen.getAllByTestId('checkbox')
    // At least one checkbox should be checked
    const checkedBoxes = checkboxes.filter((cb) => (cb as HTMLInputElement).checked)
    expect(checkedBoxes.length).toBeGreaterThanOrEqual(1)
  })

  it('hides columns that are not visible', () => {
    const columns = [
      { id: 'name' as const, label: 'Name', visible: true, width: 200 },
      { id: 'email' as const, label: 'Email', visible: false, width: 200 },
      { id: 'phone' as const, label: 'Phone', visible: true, width: 150 },
      { id: 'status' as const, label: 'Status', visible: true, width: 120 },
    ]
    render(<ContactsVirtualTable {...defaultProps} columns={columns} />)
    // Email column header should not be present in data cells
    // john@example.com should not appear since email column is hidden
    expect(screen.queryByText('john@example.com')).not.toBeInTheDocument()
  })
})
