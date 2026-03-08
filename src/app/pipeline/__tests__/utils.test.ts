import { describe, it, expect } from 'vitest'
import { getLengthOfStay, formatDisplayDate } from '../utils'

describe('getLengthOfStay', () => {
  it('returns correct number of days for valid date range', () => {
    expect(getLengthOfStay('2025-01-01', '2025-01-10')).toBe('9 days')
  })

  it('returns correct number of days for a longer range', () => {
    expect(getLengthOfStay('2025-03-01', '2025-03-31')).toBe('30 days')
  })

  it('returns "0 days" when start and end are the same date', () => {
    // Math.ceil(0) = 0, so "0 days"
    expect(getLengthOfStay('2025-06-15', '2025-06-15')).toBe('0 days')
  })

  it('handles dates where end is before start (uses absolute difference)', () => {
    expect(getLengthOfStay('2025-01-10', '2025-01-01')).toBe('9 days')
  })

  it('returns "-" for invalid start date', () => {
    expect(getLengthOfStay('not-a-date', '2025-01-10')).toBe('-')
  })

  it('returns "-" for invalid end date', () => {
    expect(getLengthOfStay('2025-01-01', 'invalid')).toBe('-')
  })

  it('returns "-" for both dates invalid', () => {
    expect(getLengthOfStay('', '')).toBe('-')
  })

  it('calculates across month boundaries correctly', () => {
    expect(getLengthOfStay('2025-01-28', '2025-02-04')).toBe('7 days')
  })
})

describe('formatDisplayDate', () => {
  it('converts YYYY-MM-DD to MM/DD/YYYY', () => {
    expect(formatDisplayDate('2025-01-15')).toBe('01/15/2025')
  })

  it('converts another date correctly', () => {
    expect(formatDisplayDate('2024-12-25')).toBe('12/25/2024')
  })

  it('returns "-" for empty string', () => {
    expect(formatDisplayDate('')).toBe('-')
  })

  it('returns the original string if not in YYYY-MM-DD format', () => {
    expect(formatDisplayDate('January 1')).toBe('January 1')
  })

  it('handles single-part date string by returning it as-is', () => {
    expect(formatDisplayDate('2025')).toBe('2025')
  })
})
