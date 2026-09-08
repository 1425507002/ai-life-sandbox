import { verifiedScriptPackages } from './scripts'

export interface ScriptCatalogEntry {
  id: string
  title: string
  category: string
  score: number
  status: 'verified'
  description: string
}

export const verifiedScriptCatalog: ScriptCatalogEntry[] = verifiedScriptPackages
  .filter((script) => script.manifest.readiness === 'verified' && typeof script.manifest.score === 'number' && script.manifest.score >= 85)
  .map((script) => ({
    id: script.manifest.id,
    title: script.manifest.title,
    category: script.manifest.category ?? '未分类',
    score: script.manifest.score ?? 0,
    status: 'verified' as const,
    description: script.manifest.description,
  }))

export function isVerifiedScript(scriptId: string) {
  return verifiedScriptCatalog.some((script) => script.id === scriptId)
}

