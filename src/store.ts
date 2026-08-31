import { create } from 'zustand'
import { buildInitialState, resolveAction } from './engine/actionEngine'
import { generateNarration } from './engine/aiProvider'
import { scriptPackages } from './data/scripts'
import { loadRuntime, saveRuntime } from './storage'
import type { ActionGenerationMode, ActionSummary, GameSession, GameState, NavKey, ProviderConfig, ScriptPackage } from './types'

const DEFAULT_PROVIDER: ProviderConfig = { endpoint: 'https://api.openai.com/v1/chat/completions', apiKey: '', model: 'gpt-4o-mini' }

interface GameStore {
  sessions: Record<string, GameSession>
  scripts: ScriptPackage[]
  activeScriptId: string
  activeNav: NavKey
  providerConfig: ProviderConfig
  actionMode: ActionGenerationMode
  hydrated: boolean
  lastAction: ActionSummary | null
  selectScript: (scriptId: string) => void
  setNav: (nav: NavKey) => void
  setActionMode: (mode: ActionGenerationMode) => void
  runAction: (input: string) => Promise<void>
  setProviderConfig: (config: Partial<ProviderConfig>) => void
  hydrate: () => Promise<void>
  resetSession: (scriptId?: string) => void
  importRuntime: (runtime: unknown) => void
  importScriptPackage: (script: unknown) => boolean
  getExportPayload: () => unknown
}

function makeSessions(scripts: ScriptPackage[]): Record<string, GameSession> {
  return Object.fromEntries(scripts.map((script) => [script.manifest.id, { scriptId: script.manifest.id, state: buildInitialState(script) }]))
}

function isScriptPackage(input: unknown): input is ScriptPackage {
  if (!input || typeof input !== 'object') return false
  const candidate = input as Partial<ScriptPackage>
  const manifest = candidate.manifest
  const theme = candidate.theme
  const world = candidate.world
  return Boolean(
    manifest && typeof manifest.id === 'string' && typeof manifest.title === 'string' &&
    typeof manifest.subtitle === 'string' && typeof manifest.version === 'string' &&
    typeof manifest.author === 'string' && typeof manifest.description === 'string' &&
    Array.isArray(manifest.capabilities) && theme && world &&
    typeof world.startingLocation === 'string' && Array.isArray(world.opening) && world.seedState,
  )
}

function mergeScripts(scripts: unknown): ScriptPackage[] {
  const custom = Array.isArray(scripts) ? scripts.filter(isScriptPackage) : []
  const merged = new Map(scriptPackages.map((script) => [script.manifest.id, script]))
  custom.forEach((script) => merged.set(script.manifest.id, script))
  return [...merged.values()]
}

function findScript(scripts: ScriptPackage[], id: string) {
  return scripts.find((script) => script.manifest.id === id) ?? scriptPackages[0]
}

function isActionGenerationMode(input: unknown): input is ActionGenerationMode {
  return input === 'guided' || input === 'varied' || input === 'freeform'
}

function persist(state: Pick<GameStore, 'sessions' | 'activeScriptId' | 'providerConfig' | 'actionMode' | 'scripts'>) {
  void saveRuntime({ sessions: state.sessions, activeScriptId: state.activeScriptId, providerConfig: state.providerConfig, actionMode: state.actionMode, scripts: state.scripts })
}

export const useGameStore = create<GameStore>((set, get) => ({
  scripts: scriptPackages,
  sessions: makeSessions(scriptPackages),
  activeScriptId: 'dawnmere',
  activeNav: 'play',
  providerConfig: DEFAULT_PROVIDER,
  actionMode: 'guided',
  hydrated: false,
  lastAction: null,
  selectScript: (scriptId) => set((state) => {
    if (!state.scripts.some((script) => script.manifest.id === scriptId)) return state
    const next = { ...state, activeScriptId: scriptId, activeNav: 'play' as NavKey }
    persist(next)
    return next
  }),
  setNav: (activeNav) => set({ activeNav }),
  setActionMode: (actionMode) => set((state) => {
    persist({ ...state, actionMode })
    return { actionMode }
  }),
  runAction: async (input) => {
    const { activeScriptId, sessions, providerConfig, scripts } = get()
    const script = findScript(scripts, activeScriptId)
    const session = sessions[activeScriptId]
    if (!session) return
    const result = resolveAction(session.state, input, script)
    const maybeNarrative = result.outcome !== 'refused' ? await generateNarration(providerConfig, { input, result: result.narrative, state: result.state }) : null
    const finalState: GameState = maybeNarrative ? { ...result.state, world: { ...result.state.world, narrative: maybeNarrative } } : result.state
    const nextSessions = { ...sessions, [activeScriptId]: { ...session, state: finalState } }
    set({ sessions: nextSessions, lastAction: { title: result.title, feedback: result.feedback, outcome: result.outcome, timeLabel: result.timeLabel, deltas: result.deltas } })
    persist({ sessions: nextSessions, activeScriptId, providerConfig, actionMode: get().actionMode, scripts })
  },
  setProviderConfig: (config) => set((state) => {
    const providerConfig = { ...state.providerConfig, ...config }
    persist({ ...state, providerConfig })
    return { providerConfig }
  }),
  hydrate: async () => {
    const runtime = await loadRuntime()
    const scripts = mergeScripts(runtime?.scripts)
    const sessions = { ...makeSessions(scripts), ...(runtime?.sessions ?? {}) }
    const activeScriptId = runtime?.activeScriptId && scripts.some((script) => script.manifest.id === runtime.activeScriptId) ? runtime.activeScriptId : scripts[0].manifest.id
    set({ scripts, sessions, activeScriptId, providerConfig: runtime?.providerConfig ?? DEFAULT_PROVIDER, actionMode: isActionGenerationMode(runtime?.actionMode) ? runtime.actionMode : 'guided', hydrated: true })
  },
  resetSession: (scriptId = get().activeScriptId) => set((state) => {
    const script = findScript(state.scripts, scriptId)
    const sessions = { ...state.sessions, [scriptId]: { scriptId, state: buildInitialState(script) } }
    persist({ ...state, sessions })
    return { sessions, lastAction: null }
  }),
  importRuntime: (runtime) => {
    if (!runtime || typeof runtime !== 'object') return
    const candidate = runtime as Partial<{ sessions: Record<string, GameSession>; activeScriptId: string; providerConfig: ProviderConfig; actionMode: ActionGenerationMode; scripts: ScriptPackage[] }>
    if (!candidate.sessions) return
    const scripts = mergeScripts(candidate.scripts ?? get().scripts)
    const activeScriptId = candidate.activeScriptId && scripts.some((script) => script.manifest.id === candidate.activeScriptId) ? candidate.activeScriptId : scripts[0].manifest.id
    const sessions = { ...makeSessions(scripts), ...candidate.sessions }
    const providerConfig = candidate.providerConfig ?? DEFAULT_PROVIDER
    const actionMode = isActionGenerationMode(candidate.actionMode) ? candidate.actionMode : 'guided'
    set({ scripts, sessions, activeScriptId, providerConfig, actionMode, activeNav: 'play' })
    persist({ sessions, activeScriptId, providerConfig, actionMode, scripts })
  },
  importScriptPackage: (input) => {
    if (!isScriptPackage(input)) return false
    const script = input
    set((state) => {
      const scripts = [...state.scripts.filter((item) => item.manifest.id !== script.manifest.id), script]
      const sessions = { ...state.sessions, [script.manifest.id]: state.sessions[script.manifest.id] ?? { scriptId: script.manifest.id, state: buildInitialState(script) } }
      persist({ ...state, scripts, sessions, activeScriptId: script.manifest.id })
      return { scripts, sessions, activeScriptId: script.manifest.id, activeNav: 'play' as NavKey, lastAction: null }
    })
    return true
  },
  getExportPayload: () => {
    const { sessions, activeScriptId, providerConfig, actionMode, scripts } = get()
    return { format: 'ai-life-world-save', version: 1, exportedAt: new Date().toISOString(), sessions, activeScriptId, providerConfig, actionMode, scripts }
  },
}))
