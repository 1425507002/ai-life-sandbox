import type { ActionGenerationMode, GameSession, ProviderConfig, ScriptPackage, UiThemeId } from './types'

const DB_NAME = 'ai-life-worlds'
const STORE_NAME = 'runtime'
const RUNTIME_KEY = 'runtime-v1'

interface PersistedRuntime {
  sessions: Record<string, GameSession>
  activeScriptId: string
  activeLifeId?: string
  providerConfig: ProviderConfig
  actionMode?: ActionGenerationMode
  uiThemeId?: UiThemeId
  scripts?: ScriptPackage[]
}

export function validateRuntimePayload(input: unknown): input is PersistedRuntime {
  if (!input || typeof input !== 'object') return false
  const candidate = input as Partial<PersistedRuntime>
  const provider = candidate.providerConfig
  return Boolean(
    candidate.sessions && typeof candidate.sessions === 'object' && !Array.isArray(candidate.sessions) &&
    typeof candidate.activeScriptId === 'string' && provider &&
    typeof provider.endpoint === 'string' && typeof provider.apiKey === 'string' && typeof provider.model === 'string' &&
    (!candidate.scripts || Array.isArray(candidate.scripts)),
  )
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadRuntime(): Promise<PersistedRuntime | null> {
  if (!('indexedDB' in window)) return null
  try {
    const db = await openDatabase()
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RUNTIME_KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch { return null }
}

export async function saveRuntime(runtime: PersistedRuntime) {
  if (!('indexedDB' in window)) return
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(runtime, RUNTIME_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch { /* Persistence is a progressive enhancement. */ }
}

export function downloadSave(payload: unknown, filename = 'ai-life-world-save.json') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
