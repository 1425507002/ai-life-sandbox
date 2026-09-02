import { describe, expect, it } from 'vitest'
import { getScript } from '../data/scripts'
import { validateScriptPackage, validateSuggestedAction } from './scriptSchema'

describe('script package schema', () => {
  it('accepts the built-in scripts with phase two rules and events', () => {
    const result = validateScriptPackage(getScript('dawnmere'))
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('validates map metadata and rejects an invalid map seed', () => {
    const script = structuredClone(getScript('western-world'))
    expect(validateScriptPackage(script).valid).toBe(true)
    script.maps![0].availableRoles = ['合法身份', 3 as unknown as string]
    const result = validateScriptPackage(script)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('maps[0].availableRoles'))).toBe(true)
  })

  it('rejects malformed packages instead of partially importing them', () => {
    const invalid = structuredClone(getScript('dawnmere')) as unknown as Record<string, unknown>
    delete invalid.theme
    const result = validateScriptPackage(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('manifest、theme 和 world')
  })

  it('rejects action candidates with unsafe or invalid schema values', () => {
    expect(validateSuggestedAction({ id: 'bad', title: '坏行动', description: 'x', location: 'x', timeCost: -1, moneyCost: 0, staminaCost: 1, risk: '低', tone: 'unknown' })).toBe(false)
  })
})
