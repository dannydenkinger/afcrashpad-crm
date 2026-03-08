import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ── Re-create Zod schemas from pipeline/actions.ts ──────────────────────────

const firestoreIdSchema = z.string().min(1).max(128)

const createNewDealSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  base: z.string().max(200).optional().or(z.literal("")),
  stage: z.string().max(100).optional(),
  value: z.union([z.string(), z.number()]).optional(),
  margin: z.union([z.string(), z.number()]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
  contactId: z.string().optional(),
  assigneeId: z.string().optional().nullable(),
  specialAccommodationId: z.string().optional().nullable(),
})

const updateOpportunitySchema = z.object({
  pipelineStageId: z.string().optional(),
  name: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  value: z.number().optional(),
  margin: z.number().optional(),
  priority: z.string().max(50).optional(),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  base: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().nullable(),
  contactId: z.string().optional(),
  assigneeId: z.string().optional().nullable(),
  leadSourceId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  specialAccommodationId: z.string().optional().nullable(),
  blockers: z.array(z.string().max(500)).max(20).optional(),
  revenueStatus: z.enum(["booked", "collected", "partial"]).optional(),
  collectedAmount: z.number().min(0).optional(),
  collectedDate: z.string().optional().or(z.literal("")),
  paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
})

const bulkCreateOpportunitiesSchema = z.object({
  opportunities: z.array(z.object({
    name: z.string().max(200).optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(50).optional().or(z.literal("")),
    base: z.string().max(200).optional().or(z.literal("")),
    stage: z.string().max(100).optional(),
    dealName: z.string().max(200).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    margin: z.union([z.string(), z.number()]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  })).min(1).max(500),
  pipelineId: firestoreIdSchema,
})

const createPipelineSchema = z.object({
  name: z.string().min(1).max(200),
})

const createPipelineStageSchema = z.object({
  pipelineId: firestoreIdSchema,
  name: z.string().min(1).max(200),
  order: z.number().int().min(0),
})

const deleteOpportunitySchema = z.object({ id: firestoreIdSchema })

const updateBlockersSchema = z.object({
  id: firestoreIdSchema,
  blockers: z.array(z.string().max(500)).max(20),
})

const addPaymentSchema = z.object({
  dealId: firestoreIdSchema,
  amount: z.number().positive("Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  method: z.enum(["check", "ach", "credit_card", "wire", "cash", "other"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

const updateRequiredDocsSchema = z.object({
  opportunityId: firestoreIdSchema,
  field: z.enum(["lease", "tc", "payment"]),
  value: z.boolean(),
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Pipeline Actions - Zod Schema Validation', () => {

  describe('createNewDealSchema', () => {
    it('accepts a valid deal with all fields', () => {
      const result = createNewDealSchema.safeParse({
        name: 'SGT Smith',
        email: 'smith@army.mil',
        phone: '555-0100',
        base: 'Fort Bragg',
        stage: 'New Lead',
        value: 3500,
        margin: 875,
        priority: 'HIGH',
        startDate: '2026-05-01',
        endDate: '2026-05-30',
        notes: 'TDY orders pending.',
        assigneeId: 'agent1',
        specialAccommodationId: 'acc1',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a minimal deal (empty object)', () => {
      const result = createNewDealSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects an invalid email', () => {
      const result = createNewDealSchema.safeParse({ email: 'bad-email' })
      expect(result.success).toBe(false)
    })

    it('allows empty string email (form clearing)', () => {
      const result = createNewDealSchema.safeParse({ email: '' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid priority value', () => {
      const result = createNewDealSchema.safeParse({ priority: 'URGENT' })
      expect(result.success).toBe(false)
    })

    it('accepts value as string (CSV import)', () => {
      const result = createNewDealSchema.safeParse({ value: '3500' })
      expect(result.success).toBe(true)
    })

    it('accepts value as number', () => {
      const result = createNewDealSchema.safeParse({ value: 3500 })
      expect(result.success).toBe(true)
    })

    it('rejects notes exceeding 5000 characters', () => {
      const result = createNewDealSchema.safeParse({ notes: 'X'.repeat(5001) })
      expect(result.success).toBe(false)
    })
  })

  describe('updateOpportunitySchema', () => {
    it('accepts a stage move (pipelineStageId only)', () => {
      const result = updateOpportunitySchema.safeParse({
        pipelineStageId: 'stage-xyz',
      })
      expect(result.success).toBe(true)
    })

    it('accepts revenue status update', () => {
      const result = updateOpportunitySchema.safeParse({
        revenueStatus: 'collected',
        collectedAmount: 3500,
        collectedDate: '2026-04-15',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid revenueStatus', () => {
      const result = updateOpportunitySchema.safeParse({ revenueStatus: 'pending' })
      expect(result.success).toBe(false)
    })

    it('rejects negative collectedAmount', () => {
      const result = updateOpportunitySchema.safeParse({ collectedAmount: -100 })
      expect(result.success).toBe(false)
    })

    it('accepts blockers array', () => {
      const result = updateOpportunitySchema.safeParse({
        blockers: ['Waiting for lease', 'Need payment auth'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects more than 20 blockers', () => {
      const blockers = Array.from({ length: 21 }, (_, i) => `Blocker ${i}`)
      const result = updateOpportunitySchema.safeParse({ blockers })
      expect(result.success).toBe(false)
    })

    it('rejects invalid paymentStatus', () => {
      const result = updateOpportunitySchema.safeParse({ paymentStatus: 'overdue' })
      expect(result.success).toBe(false)
    })
  })

  describe('bulkCreateOpportunitiesSchema', () => {
    it('accepts a valid bulk import', () => {
      const result = bulkCreateOpportunitiesSchema.safeParse({
        opportunities: [
          { name: 'Lead 1', email: 'a@b.com', priority: 'LOW' },
          { name: 'Lead 2', email: 'c@d.com', priority: 'HIGH' },
        ],
        pipelineId: 'pipeline1',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty opportunities array', () => {
      const result = bulkCreateOpportunitiesSchema.safeParse({
        opportunities: [],
        pipelineId: 'pipeline1',
      })
      expect(result.success).toBe(false)
    })

    it('rejects more than 500 opportunities', () => {
      const opportunities = Array.from({ length: 501 }, () => ({ name: 'Lead' }))
      const result = bulkCreateOpportunitiesSchema.safeParse({
        opportunities,
        pipelineId: 'pipeline1',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing pipelineId', () => {
      const result = bulkCreateOpportunitiesSchema.safeParse({
        opportunities: [{ name: 'Lead 1' }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createPipelineSchema', () => {
    it('accepts a valid pipeline name', () => {
      const result = createPipelineSchema.safeParse({ name: 'My Pipeline' })
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const result = createPipelineSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
    })

    it('rejects name exceeding 200 chars', () => {
      const result = createPipelineSchema.safeParse({ name: 'P'.repeat(201) })
      expect(result.success).toBe(false)
    })
  })

  describe('createPipelineStageSchema', () => {
    it('accepts valid stage data', () => {
      const result = createPipelineStageSchema.safeParse({
        pipelineId: 'p1',
        name: 'New Lead',
        order: 0,
      })
      expect(result.success).toBe(true)
    })

    it('rejects negative order', () => {
      const result = createPipelineStageSchema.safeParse({
        pipelineId: 'p1',
        name: 'Stage',
        order: -1,
      })
      expect(result.success).toBe(false)
    })

    it('rejects float order', () => {
      const result = createPipelineStageSchema.safeParse({
        pipelineId: 'p1',
        name: 'Stage',
        order: 1.5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('addPaymentSchema', () => {
    it('accepts a valid payment', () => {
      const result = addPaymentSchema.safeParse({
        dealId: 'deal1',
        amount: 1500,
        date: '2026-04-01',
        method: 'ach',
      })
      expect(result.success).toBe(true)
    })

    it('rejects zero amount', () => {
      const result = addPaymentSchema.safeParse({
        dealId: 'deal1',
        amount: 0,
        date: '2026-04-01',
        method: 'cash',
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative amount', () => {
      const result = addPaymentSchema.safeParse({
        dealId: 'deal1',
        amount: -50,
        date: '2026-04-01',
        method: 'cash',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid payment method', () => {
      const result = addPaymentSchema.safeParse({
        dealId: 'deal1',
        amount: 100,
        date: '2026-04-01',
        method: 'bitcoin',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty date', () => {
      const result = addPaymentSchema.safeParse({
        dealId: 'deal1',
        amount: 100,
        date: '',
        method: 'check',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateRequiredDocsSchema', () => {
    it('accepts valid required docs update', () => {
      const result = updateRequiredDocsSchema.safeParse({
        opportunityId: 'opp1',
        field: 'lease',
        value: true,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid field name', () => {
      const result = updateRequiredDocsSchema.safeParse({
        opportunityId: 'opp1',
        field: 'insurance',
        value: true,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateBlockersSchema', () => {
    it('accepts valid blockers', () => {
      const result = updateBlockersSchema.safeParse({
        id: 'opp1',
        blockers: ['Needs approval'],
      })
      expect(result.success).toBe(true)
    })

    it('accepts empty blockers array (clearing)', () => {
      const result = updateBlockersSchema.safeParse({
        id: 'opp1',
        blockers: [],
      })
      expect(result.success).toBe(true)
    })

    it('rejects blocker text exceeding 500 chars', () => {
      const result = updateBlockersSchema.safeParse({
        id: 'opp1',
        blockers: ['X'.repeat(501)],
      })
      expect(result.success).toBe(false)
    })
  })
})
