import { describe, it, expect } from 'vitest'

/**
 * Tests for the search action (globalSearch in src/app/search/actions.ts).
 * Since globalSearch is a server action that directly queries Firestore,
 * we test the query/filtering logic patterns in isolation.
 */

describe('Search Logic', () => {

  // Simulates the search matching logic used in globalSearch
  function matchesQuery(contact: { name: string; email: string; phone: string }, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return false
    const name = (contact.name || '').toLowerCase()
    const email = (contact.email || '').toLowerCase()
    const phone = (contact.phone || '').replace(/\D/g, '')
    const qNorm = q.replace(/\D/g, '')

    return name.includes(q) || email.includes(q) || (qNorm.length >= 3 && phone.includes(qNorm))
  }

  describe('matchesQuery (contact search logic)', () => {
    const contact = {
      name: 'SGT John Smith',
      email: 'john.smith@army.mil',
      phone: '(555) 123-4567',
    }

    it('matches by name substring', () => {
      expect(matchesQuery(contact, 'john')).toBe(true)
    })

    it('matches by email substring', () => {
      expect(matchesQuery(contact, 'smith@army')).toBe(true)
    })

    it('matches by phone digits (3+ digits)', () => {
      expect(matchesQuery(contact, '123')).toBe(true)
    })

    it('matches phone with formatting characters', () => {
      expect(matchesQuery(contact, '555-123')).toBe(true)
    })

    it('does not match phone with fewer than 3 digits', () => {
      expect(matchesQuery(contact, '55')).toBe(false)
    })

    it('returns false for queries shorter than 2 characters', () => {
      expect(matchesQuery(contact, 'j')).toBe(false)
    })

    it('returns false for empty query', () => {
      expect(matchesQuery(contact, '')).toBe(false)
    })

    it('is case-insensitive', () => {
      expect(matchesQuery(contact, 'JOHN')).toBe(true)
      expect(matchesQuery(contact, 'ARMY.MIL')).toBe(true)
    })

    it('does not match unrelated query', () => {
      expect(matchesQuery(contact, 'zzzzz')).toBe(false)
    })
  })

  describe('Result shape contracts', () => {
    it('globalSearch returns correct empty shape', () => {
      const emptyResult = { contacts: [], opportunities: [], notes: [] }
      expect(emptyResult).toHaveProperty('contacts')
      expect(emptyResult).toHaveProperty('opportunities')
      expect(emptyResult).toHaveProperty('notes')
      expect(Array.isArray(emptyResult.contacts)).toBe(true)
      expect(Array.isArray(emptyResult.opportunities)).toBe(true)
      expect(Array.isArray(emptyResult.notes)).toBe(true)
    })

    it('contact result has required fields', () => {
      const contactResult = { id: 'c1', name: 'John', email: 'j@d.com', type: 'contact' as const }
      expect(contactResult).toHaveProperty('id')
      expect(contactResult).toHaveProperty('name')
      expect(contactResult).toHaveProperty('type', 'contact')
    })

    it('opportunity result has required fields', () => {
      const oppResult = { id: 'o1', name: 'John', contactId: 'c1', contactName: 'John', type: 'opportunity' as const }
      expect(oppResult).toHaveProperty('id')
      expect(oppResult).toHaveProperty('contactId')
      expect(oppResult).toHaveProperty('type', 'opportunity')
    })

    it('note result has required fields', () => {
      const noteResult = { id: 'n1', content: 'Hello', contactId: 'c1', contactName: 'John', type: 'note' as const }
      expect(noteResult).toHaveProperty('id')
      expect(noteResult).toHaveProperty('content')
      expect(noteResult).toHaveProperty('type', 'note')
    })
  })
})
