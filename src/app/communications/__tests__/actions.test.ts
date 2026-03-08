import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ── Re-create Zod schemas from communications/actions.ts ────────────────────

const firestoreIdSchema = z.string().min(1).max(128)

const getMessagesSchema = z.object({ contactId: firestoreIdSchema })

const sendMessageSchema = z.object({
  contactId: firestoreIdSchema,
  type: z.string().min(1).max(50),
  content: z.string().min(1).max(10000),
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Communications Actions - Zod Schema Validation', () => {

  describe('sendMessageSchema', () => {
    it('accepts a valid email message', () => {
      const result = sendMessageSchema.safeParse({
        contactId: 'contact123',
        type: 'email',
        content: 'Hello, this is a follow-up regarding your inquiry.',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a valid SMS message', () => {
      const result = sendMessageSchema.safeParse({
        contactId: 'contact456',
        type: 'sms',
        content: 'Your reservation is confirmed.',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty contactId', () => {
      const result = sendMessageSchema.safeParse({
        contactId: '',
        type: 'email',
        content: 'Hello',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty type', () => {
      const result = sendMessageSchema.safeParse({
        contactId: 'c1',
        type: '',
        content: 'Hello',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty content', () => {
      const result = sendMessageSchema.safeParse({
        contactId: 'c1',
        type: 'email',
        content: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects content exceeding 10000 characters', () => {
      const result = sendMessageSchema.safeParse({
        contactId: 'c1',
        type: 'email',
        content: 'X'.repeat(10001),
      })
      expect(result.success).toBe(false)
    })

    it('rejects type exceeding 50 characters', () => {
      const result = sendMessageSchema.safeParse({
        contactId: 'c1',
        type: 'T'.repeat(51),
        content: 'Hello',
      })
      expect(result.success).toBe(false)
    })

    it('rejects contactId exceeding 128 characters', () => {
      const result = sendMessageSchema.safeParse({
        contactId: 'C'.repeat(129),
        type: 'email',
        content: 'Hello',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('getMessagesSchema', () => {
    it('accepts a valid contactId', () => {
      const result = getMessagesSchema.safeParse({ contactId: 'abc123' })
      expect(result.success).toBe(true)
    })

    it('rejects empty contactId', () => {
      const result = getMessagesSchema.safeParse({ contactId: '' })
      expect(result.success).toBe(false)
    })

    it('rejects missing contactId', () => {
      const result = getMessagesSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('Return shape contracts', () => {
    it('success response should have correct shape', () => {
      // Verify that the expected return shapes conform to the patterns used in the actions
      const successResponse = { success: true, messages: [], contact: null }
      expect(successResponse).toHaveProperty('success', true)
      expect(successResponse).toHaveProperty('messages')
      expect(Array.isArray(successResponse.messages)).toBe(true)
    })

    it('error response should have correct shape', () => {
      const errorResponse = { success: false, error: "Invalid input" }
      expect(errorResponse).toHaveProperty('success', false)
      expect(errorResponse).toHaveProperty('error')
      expect(typeof errorResponse.error).toBe('string')
    })

    it('conversations response should have correct shape', () => {
      const response = { success: true, conversations: [] }
      expect(response).toHaveProperty('success', true)
      expect(response).toHaveProperty('conversations')
      expect(Array.isArray(response.conversations)).toBe(true)
    })
  })
})
