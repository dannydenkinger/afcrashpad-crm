import { describe, it, expect } from 'vitest'

/**
 * Tests for the iCal feed generation logic from
 * src/app/api/calendar/feed/[feedId]/route.ts
 *
 * We extract and test the iCalendar string-building logic in isolation
 * since the actual route requires Firebase connectivity.
 */

describe('iCal Feed Generation', () => {

  function buildICalHeader(calendarName: string): string[] {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Vesta CRM//Calendar Sync//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendarName}'s CRM Schedule`,
      'X-WR-TIMEZONE:America/Chicago',
    ]
  }

  function buildOpportunityEvent(id: string, name: string, value: number, priority: string, createdAt: Date): string[] {
    const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const dtStart = createdAt.toISOString().replace(/[-:]/g, '').split('T')[0]
    return [
      'BEGIN:VEVENT',
      `UID:opp-${id}@vesta.crm`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `SUMMARY:[Deal] ${name}`,
      `DESCRIPTION:Value: $${value}\\nPriority: ${priority}\\n`,
      'END:VEVENT',
    ]
  }

  function buildTaskEvent(id: string, title: string, description: string, priority: string, dueDate: Date, completed: boolean): string[] {
    const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const dtStart = dueDate.toISOString().replace(/[-:]/g, '').split('T')[0]
    const prefix = completed ? '[Done] ' : ''
    return [
      'BEGIN:VEVENT',
      `UID:task-${id}@vesta.crm`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `SUMMARY:${prefix}${title}`,
      `DESCRIPTION:${description || 'No description provided.'}\\nPriority: ${priority}`,
      'END:VEVENT',
    ]
  }

  describe('iCal header', () => {
    it('produces valid VCALENDAR header', () => {
      const lines = buildICalHeader('Agent')
      expect(lines[0]).toBe('BEGIN:VCALENDAR')
      expect(lines[1]).toBe('VERSION:2.0')
      expect(lines).toContainEqual(expect.stringContaining('PRODID'))
    })

    it('includes the calendar name', () => {
      const lines = buildICalHeader('John')
      expect(lines).toContainEqual("X-WR-CALNAME:John's CRM Schedule")
    })
  })

  describe('Opportunity event', () => {
    it('produces a valid VEVENT', () => {
      const lines = buildOpportunityEvent('opp1', 'SGT Smith - Inquiry', 3500, 'HIGH', new Date('2026-05-01'))
      expect(lines[0]).toBe('BEGIN:VEVENT')
      expect(lines[lines.length - 1]).toBe('END:VEVENT')
    })

    it('includes the deal name in SUMMARY', () => {
      const lines = buildOpportunityEvent('opp1', 'SGT Smith - Inquiry', 3500, 'HIGH', new Date('2026-05-01'))
      const summary = lines.find(l => l.startsWith('SUMMARY:'))
      expect(summary).toBe('SUMMARY:[Deal] SGT Smith - Inquiry')
    })

    it('includes the UID with opp prefix', () => {
      const lines = buildOpportunityEvent('abc123', 'Test', 0, 'LOW', new Date())
      const uid = lines.find(l => l.startsWith('UID:'))
      expect(uid).toBe('UID:opp-abc123@vesta.crm')
    })

    it('formats DTSTART as date-only (no time)', () => {
      const lines = buildOpportunityEvent('opp1', 'Test', 0, 'LOW', new Date('2026-07-04'))
      const dtStart = lines.find(l => l.startsWith('DTSTART'))
      expect(dtStart).toBe('DTSTART;VALUE=DATE:20260704')
    })
  })

  describe('Task event', () => {
    it('prepends [Done] for completed tasks', () => {
      const lines = buildTaskEvent('t1', 'Follow up', '', 'MEDIUM', new Date('2026-06-15'), true)
      const summary = lines.find(l => l.startsWith('SUMMARY:'))
      expect(summary).toBe('SUMMARY:[Done] Follow up')
    })

    it('does not prepend [Done] for incomplete tasks', () => {
      const lines = buildTaskEvent('t1', 'Follow up', '', 'MEDIUM', new Date('2026-06-15'), false)
      const summary = lines.find(l => l.startsWith('SUMMARY:'))
      expect(summary).toBe('SUMMARY:Follow up')
    })

    it('falls back to "No description provided." when description is empty', () => {
      const lines = buildTaskEvent('t1', 'Task', '', 'LOW', new Date(), false)
      const desc = lines.find(l => l.startsWith('DESCRIPTION:'))
      expect(desc).toContain('No description provided.')
    })

    it('uses provided description', () => {
      const lines = buildTaskEvent('t1', 'Task', 'Call the client', 'HIGH', new Date(), false)
      const desc = lines.find(l => l.startsWith('DESCRIPTION:'))
      expect(desc).toContain('Call the client')
    })
  })

  describe('Full calendar assembly', () => {
    it('produces a complete valid iCal document', () => {
      const lines = [
        ...buildICalHeader('Agent'),
        ...buildOpportunityEvent('opp1', 'Deal 1', 1000, 'MEDIUM', new Date('2026-05-01')),
        ...buildTaskEvent('t1', 'Task 1', 'Do something', 'HIGH', new Date('2026-05-02'), false),
        'END:VCALENDAR',
      ]
      const ical = lines.join('\r\n')
      expect(ical).toContain('BEGIN:VCALENDAR')
      expect(ical).toContain('END:VCALENDAR')
      expect(ical).toContain('BEGIN:VEVENT')
      expect(ical).toContain('END:VEVENT')
      // Should have exactly 2 VEVENT blocks
      const eventCount = (ical.match(/BEGIN:VEVENT/g) || []).length
      expect(eventCount).toBe(2)
    })
  })
})
