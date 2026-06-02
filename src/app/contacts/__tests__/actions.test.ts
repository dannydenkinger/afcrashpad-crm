import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// ── Re-create Zod schemas from the source to test validation logic ──────────

const firestoreIdSchema = z.string().min(1).max(128)

const createContactSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().max(50).optional().or(z.literal("")).nullable(),
  businessName: z.string().max(200).optional().or(z.literal("")).nullable(),
  status: z.string().max(50).optional(),
  stayStartDate: z.string().optional().or(z.literal("")).nullable(),
  stayEndDate: z.string().optional().or(z.literal("")).nullable(),
  tags: z.array(z.string()).optional(),
})

const updateContactSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().max(50).optional().or(z.literal("")).nullable(),
  businessName: z.string().max(200).optional().or(z.literal("")).nullable(),
  status: z.string().max(50).optional(),
  stayStartDate: z.string().optional().or(z.literal("")).nullable(),
  stayEndDate: z.string().optional().or(z.literal("")).nullable(),
  tags: z.array(z.string()).optional(),
})

const bulkDeleteContactsSchema = z.object({
  ids: z.array(firestoreIdSchema).min(1).max(500),
})

const bulkUpdateStatusSchema = z.object({
  ids: z.array(firestoreIdSchema).min(1).max(500),
  status: z.string().min(1).max(50),
})

const bulkAddTagSchema = z.object({
  ids: z.array(firestoreIdSchema).min(1).max(500),
  tag: z.string().min(1).max(100),
})

const mergeContactsSchema = z.object({
  primaryId: firestoreIdSchema,
  secondaryId: firestoreIdSchema,
  fieldOverrides: z.record(z.string(), z.string()).optional(),
})

const createNoteSchema = z.object({
  contactId: firestoreIdSchema,
  content: z.string().min(1).max(10000),
  options: z.object({
    opportunityId: z.string().optional(),
    source: z.string().max(50).optional(),
    mentions: z.array(z.object({
      userId: z.string().min(1).max(128),
      userName: z.string().min(1).max(200),
    })).optional(),
  }).optional(),
})

const deleteNoteSchema = z.object({
  contactId: firestoreIdSchema,
  noteId: firestoreIdSchema,
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Contact Actions - Zod Schema Validation', () => {

  describe('createContactSchema', () => {
    it('accepts a valid contact with all fields', () => {
      const result = createContactSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        businessName: 'Doe Industries',
        status: 'Lead',
        stayStartDate: '2026-04-01',
        stayEndDate: '2026-04-15',
        tags: ['tag1', 'tag2'],
      })
      expect(result.success).toBe(true)
    })

    it('accepts a minimal contact (all optional fields omitted)', () => {
      const result = createContactSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects an invalid email address', () => {
      const result = createContactSchema.safeParse({ email: 'not-an-email' })
      expect(result.success).toBe(false)
    })

    it('allows empty string for email (form clearing)', () => {
      const result = createContactSchema.safeParse({ email: '' })
      expect(result.success).toBe(true)
    })

    it('allows null for email', () => {
      const result = createContactSchema.safeParse({ email: null })
      expect(result.success).toBe(true)
    })

    it('rejects name exceeding 200 characters', () => {
      const result = createContactSchema.safeParse({ name: 'A'.repeat(201) })
      expect(result.success).toBe(false)
    })

    it('rejects phone exceeding 50 characters', () => {
      const result = createContactSchema.safeParse({ phone: '1'.repeat(51) })
      expect(result.success).toBe(false)
    })
  })

  describe('updateContactSchema', () => {
    it('accepts partial updates', () => {
      const result = updateContactSchema.safeParse({ name: 'Jane Doe' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email in update', () => {
      const result = updateContactSchema.safeParse({ email: 'bad' })
      expect(result.success).toBe(false)
    })
  })

  describe('mergeContactsSchema', () => {
    it('accepts valid primary and secondary IDs', () => {
      const result = mergeContactsSchema.safeParse({
        primaryId: 'abc123',
        secondaryId: 'def456',
      })
      expect(result.success).toBe(true)
    })

    it('accepts merge with fieldOverrides', () => {
      const result = mergeContactsSchema.safeParse({
        primaryId: 'abc123',
        secondaryId: 'def456',
        fieldOverrides: { name: 'secondary', email: 'primary' },
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty primary ID', () => {
      const result = mergeContactsSchema.safeParse({
        primaryId: '',
        secondaryId: 'def456',
      })
      expect(result.success).toBe(false)
    })

    it('rejects ID exceeding 128 characters', () => {
      const result = mergeContactsSchema.safeParse({
        primaryId: 'x'.repeat(129),
        secondaryId: 'def456',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing secondaryId', () => {
      const result = mergeContactsSchema.safeParse({
        primaryId: 'abc123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('bulkDeleteContactsSchema', () => {
    it('accepts an array of valid IDs', () => {
      const result = bulkDeleteContactsSchema.safeParse({
        ids: ['id1', 'id2', 'id3'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects an empty array', () => {
      const result = bulkDeleteContactsSchema.safeParse({ ids: [] })
      expect(result.success).toBe(false)
    })

    it('rejects more than 500 IDs', () => {
      const ids = Array.from({ length: 501 }, (_, i) => `id${i}`)
      const result = bulkDeleteContactsSchema.safeParse({ ids })
      expect(result.success).toBe(false)
    })
  })

  describe('bulkUpdateStatusSchema', () => {
    it('accepts valid IDs and status', () => {
      const result = bulkUpdateStatusSchema.safeParse({
        ids: ['id1', 'id2'],
        status: 'Active',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty status', () => {
      const result = bulkUpdateStatusSchema.safeParse({
        ids: ['id1'],
        status: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('bulkAddTagSchema', () => {
    it('accepts valid IDs and tag', () => {
      const result = bulkAddTagSchema.safeParse({
        ids: ['id1'],
        tag: 'VIP',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty tag', () => {
      const result = bulkAddTagSchema.safeParse({
        ids: ['id1'],
        tag: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects tag exceeding 100 characters', () => {
      const result = bulkAddTagSchema.safeParse({
        ids: ['id1'],
        tag: 'T'.repeat(101),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createNoteSchema', () => {
    it('accepts a valid note', () => {
      const result = createNoteSchema.safeParse({
        contactId: 'contact123',
        content: 'This is a note.',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a note with mentions', () => {
      const result = createNoteSchema.safeParse({
        contactId: 'contact123',
        content: 'Hey @John check this',
        options: {
          mentions: [{ userId: 'user1', userName: 'John' }],
        },
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty content', () => {
      const result = createNoteSchema.safeParse({
        contactId: 'contact123',
        content: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects content exceeding 10000 characters', () => {
      const result = createNoteSchema.safeParse({
        contactId: 'contact123',
        content: 'X'.repeat(10001),
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty contactId', () => {
      const result = createNoteSchema.safeParse({
        contactId: '',
        content: 'note',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('deleteNoteSchema', () => {
    it('accepts valid IDs', () => {
      const result = deleteNoteSchema.safeParse({
        contactId: 'c1',
        noteId: 'n1',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing noteId', () => {
      const result = deleteNoteSchema.safeParse({
        contactId: 'c1',
      })
      expect(result.success).toBe(false)
    })
  })
})
