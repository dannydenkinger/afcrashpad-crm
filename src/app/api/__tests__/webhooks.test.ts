import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// ── Re-create the webhook validation schema from the route ──────────────────

const webhookSchema = z.object({
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  base: z.string().optional(),
  notes: z.string().optional(),
  reason_for_stay: z.string().optional(),
})

// ── Re-create the date normalization helpers from the route ──────────────────

function normalizeDateToYmd(input: unknown): string | null {
  if (!input) return null
  const s = String(input).trim()
  if (!s) return null

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return s

  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) {
    const mm = String(Number(usMatch[1])).padStart(2, '0')
    const dd = String(Number(usMatch[2])).padStart(2, '0')
    const yyyy = usMatch[3]
    return `${yyyy}-${mm}-${dd}`
  }

  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function ymdToIsoNoon(ymd: string): string | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const yyyy = Number(m[1])
  const mm = Number(m[2])
  const dd = Number(m[3])
  const d = new Date(yyyy, mm - 1, dd, 12, 0, 0)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Webhook Lead Processing', () => {

  describe('webhookSchema validation', () => {
    it('accepts a valid lead payload', () => {
      const result = webhookSchema.safeParse({
        email: 'sgt.smith@army.mil',
        name: 'SGT Smith',
        phone: '555-0100',
        base: 'Fort Bragg',
        startDate: '2026-05-01',
        endDate: '2026-05-30',
      })
      expect(result.success).toBe(true)
    })

    it('requires a valid email', () => {
      const result = webhookSchema.safeParse({
        name: 'SGT Smith',
        email: 'not-valid',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Valid email is required')
      }
    })

    it('rejects payload without email', () => {
      const result = webhookSchema.safeParse({
        name: 'SGT Smith',
        phone: '555-0100',
      })
      expect(result.success).toBe(false)
    })

    it('accepts minimal payload (email only)', () => {
      const result = webhookSchema.safeParse({ email: 'min@test.com' })
      expect(result.success).toBe(true)
    })
  })

  describe('normalizeDateToYmd', () => {
    it('parses ISO format (YYYY-MM-DD)', () => {
      expect(normalizeDateToYmd('2026-05-15')).toBe('2026-05-15')
    })

    it('parses US format (MM/DD/YYYY)', () => {
      expect(normalizeDateToYmd('5/15/2026')).toBe('2026-05-15')
    })

    it('parses US format with leading zeros', () => {
      expect(normalizeDateToYmd('05/01/2026')).toBe('2026-05-01')
    })

    it('returns null for empty input', () => {
      expect(normalizeDateToYmd('')).toBeNull()
      expect(normalizeDateToYmd(null)).toBeNull()
      expect(normalizeDateToYmd(undefined)).toBeNull()
    })

    it('returns null for unparseable string', () => {
      expect(normalizeDateToYmd('not-a-date')).toBeNull()
    })
  })

  describe('ymdToIsoNoon', () => {
    it('converts YYYY-MM-DD to ISO noon string', () => {
      const result = ymdToIsoNoon('2026-05-15')
      expect(result).toContain('2026-05-15')
      expect(result).toContain('T')
    })

    it('returns null for invalid format', () => {
      expect(ymdToIsoNoon('05/15/2026')).toBeNull()
      expect(ymdToIsoNoon('')).toBeNull()
    })
  })

  describe('Field normalization logic', () => {
    it('builds name from first_name + last_name when name is absent', () => {
      const raw: any = { first_name: 'John', last_name: 'Doe', email: 'j@d.com' }
      const finalName = raw.name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || 'Website Lead'
      expect(finalName).toBe('John Doe')
    })

    it('defaults to "Website Lead" when no name fields are present', () => {
      const raw = { email: 'a@b.com' } as any
      const finalName = raw.name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || 'Website Lead'
      expect(finalName).toBe('Website Lead')
    })

    it('prefers name field over first + last', () => {
      const raw = { name: 'Full Name', first_name: 'First', last_name: 'Last', email: 'x@y.com' }
      const finalName = raw.name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || 'Website Lead'
      expect(finalName).toBe('Full Name')
    })
  })
})
