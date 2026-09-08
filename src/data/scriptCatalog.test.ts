import { describe, expect, it } from 'vitest'
import { scriptPackages } from './scripts'
import { isVerifiedScript, verifiedScriptCatalog } from './scriptCatalog'
import { validateScriptPackage } from '../engine/scriptSchema'

describe('verified script catalog', () => {
  it('only exposes scripts that passed the 85 point gate', () => {
    expect(verifiedScriptCatalog).toHaveLength(1)
    expect(verifiedScriptCatalog[0]).toMatchObject({ id: 'urban-life', title: '霓虹城的人生', score: 85.5, status: 'verified' })
    expect(verifiedScriptCatalog.every((script) => script.score >= 85)).toBe(true)
    expect(isVerifiedScript('urban-life')).toBe(true)
    expect(isVerifiedScript('frontier-tide')).toBe(false)
  })

  it('keeps the verified preset loadable by the existing runtime schema', () => {
    const urban = scriptPackages.find((script) => script.manifest.id === 'urban-life')
    expect(urban).toBeDefined()
    expect(validateScriptPackage(urban).valid).toBe(true)
    expect(urban?.maps?.[0].discoveryPolicy?.aiMustNotCreateLocation).toBe(true)
  })
})

