import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn (classname merger)', () => {
  it('merges multiple class strings', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('handles conditional classes with falsy values', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('handles undefined and null inputs', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra')
  })

  it('resolves Tailwind conflicts by keeping the last one', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6')
  })

  it('resolves conflicting text colors', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('handles array inputs via clsx', () => {
    expect(cn(['px-4', 'py-2'])).toBe('px-4 py-2')
  })
})
