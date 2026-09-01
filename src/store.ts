import { create } from 'zustand'
import { buildInitialState, resolveAction } from './engine/actionEngine'
import { generateActionCandidates, generateNarration, ZHIPU_FLASH_PROVIDER } from './engine/aiProvider'
import { scriptPackages } from './data/scripts'
import { loadRuntime, saveRuntime, validateRuntimePayload } from './storage'
import type { ActionGenerationMode, ActionSummary, GameSession, GameState, NavKey, ProviderConfig, ScriptPackage } from './types'
import { validateScriptPackage } from './engine/scriptSchema'

const DEFAULT_PROVIDER: ProviderConfig = ZHIPU_FLASH_PROVIDER
const LEGACY_DEFAULT_PROVIDER: ProviderConfig = { endpoint: 'https://api.openai.com/v1/chat/completions', apiKey: '', model: 'gpt-4o-mini' }

function migrateProviderConfig(config?: ProviderConfig) {
  if (!config) return DEFAULT_PROVIDER
  const isLegacyEmptyDefault = config.endpoint === LEGACY_DEFAULT_PROVIDER.endpoint && config.model === LEGACY_DEFAULT_PROVIDER.model && !config.apiKey.trim()
  return isLegacyEmptyDefault ? DEFAULT_PROVIDER : config
}
type StoreNotice = { type: 'success' | 'error' | 'info'; message: string }

interface GameStore {
  sessions: Record<string, GameSession>
  scripts: ScriptPackage[]
  activeScriptId: string
  activeNav: NavKey
  providerConfig: ProviderConfig
  actionMode: ActionGenerationMode
  hydrated: boolean
  lastAction: ActionSummary | null
  lastNotice: StoreNotice | null
  selectScript: (scriptId: string) => void
  setNav: (nav: NavKey) => void
  setActionMode: (mode: ActionGenerationMode) => void
  runAction: (input: string) => Promise<void>
  setProviderConfig: (config: Partial<ProviderConfig>) => void
  hydrate: () => Promise<void>
  resetSession: (scriptId?: string) => void
  updatePlayer: (patch: Partial<GameState['player']>) => void
  clearNotice: () => void
  notify: (notice: StoreNotice) => void
  importRuntime: (runtime: unknown) => void
  importScriptPackage: (script: unknown) => boolean
  getExportPayload: () => unknown
}

function makeSessions(scripts: ScriptPackage[]): Record<string, GameSession> {
  return Object.fromEntries(scripts.map((script) => [script.manifest.id, { scriptId: script.manifest.id, state: buildInitialState(script) }]))
}

function mergeScripts(scripts: unknown): ScriptPackage[] {
  const custom = Array.isArray(scripts) ? scripts.filter((script) => validateScriptPackage(script).valid) as ScriptPackage[] : []
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
  lastNotice: null,
  selectScript: (scriptId) => set((state) => {
    if (!state.scripts.some((script) => script.manifest.id === scriptId)) return state
    const next = { ...state, activeScriptId: scriptId, activeNav: 'play' as NavKey }
    persist(next)
    return { ...next, lastNotice: null }
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
    const [maybeNarrative, maybeCandidates] = result.outcome !== 'refused' ? await Promise.all([
      generateNarration(providerConfig, { input, result: result.narrative, state: result.state }),
      generateActionCandidates(providerConfig, { state: result.state, script, localCandidates: result.state.suggestedActions }),
    ]) : [null, null]
    const finalState: GameState = {
      ...result.state,
      ...(maybeNarrative ? { world: { ...result.state.world, narrative: maybeNarrative } } : {}),
      ...(maybeCandidates ? { suggestedActions: maybeCandidates } : {}),
    }
    const nextSessions = { ...sessions, [activeScriptId]: { ...session, state: finalState } }
    const aiConfigured = Boolean(providerConfig.apiKey.trim() && providerConfig.endpoint.trim() && providerConfig.model.trim())
    const lastNotice = aiConfigured && !maybeNarrative && !maybeCandidates
      ? { type: 'error' as const, message: '规则已完成，但 AI 服务未响应；已使用本地行动和叙事。' }
      : maybeNarrative || maybeCandidates ? { type: 'success' as const, message: '行动已结算，AI 候选与叙事已按规则接入。' } : null
    set({ sessions: nextSessions, lastAction: { title: result.title, feedback: result.feedback, outcome: result.outcome, timeLabel: result.timeLabel, deltas: result.deltas, stateDiff: result.stateDiff }, lastNotice })
    persist({ sessions: nextSessions, activeScriptId, providerConfig, actionMode: get().actionMode, scripts })
  },
  setProviderConfig: (config) => set((state) => {
    const providerConfig = { ...state.providerConfig, ...config }
    persist({ ...state, providerConfig })
    return { providerConfig }
  }),
  updatePlayer: (patch) => set((state) => {
    const session = state.sessions[state.activeScriptId]
    if (!session) return state
    const sessions = { ...state.sessions, [state.activeScriptId]: { ...session, state: { ...session.state, player: { ...session.state.player, ...patch } } } }
    persist({ ...state, sessions })
    return { sessions, lastNotice: { type: 'success', message: '角色档案已保存到本地。' } }
  }),
  clearNotice: () => set({ lastNotice: null }),
  notify: (lastNotice) => set({ lastNotice }),
  hydrate: async () => {
    const runtime = await loadRuntime()
    const scripts = mergeScripts(runtime?.scripts)
    const sessions = { ...makeSessions(scripts), ...(runtime?.sessions ?? {}) }
    const activeScriptId = runtime?.activeScriptId && scripts.some((script) => script.manifest.id === runtime.activeScriptId) ? runtime.activeScriptId : scripts[0].manifest.id
    set({ scripts, sessions, activeScriptId, providerConfig: migrateProviderConfig(runtime?.providerConfig), actionMode: isActionGenerationMode(runtime?.actionMode) ? runtime.actionMode : 'guided', hydrated: true, lastNotice: null })
  },
  resetSession: (scriptId = get().activeScriptId) => set((state) => {
    const script = findScript(state.scripts, scriptId)
    const sessions = { ...state.sessions, [scriptId]: { scriptId, state: buildInitialState(script) } }
    persist({ ...state, sessions })
    return { sessions, activeScriptId: scriptId, activeNav: 'play', lastAction: null, lastNotice: { type: 'info', message: '当前人生已经重新开始。' } }
  }),
  importRuntime: (runtime) => {
    if (!runtime || typeof runtime !== 'object') return
    if (!validateRuntimePayload(runtime)) {
      set({ lastNotice: { type: 'error', message: '存档格式或版本不受支持，未导入任何内容。' } })
      return
    }
    const candidate = runtime as Partial<{ sessions: Record<string, GameSession>; activeScriptId: string; providerConfig: ProviderConfig; actionMode: ActionGenerationMode; scripts: ScriptPackage[] }>
    const scripts = mergeScripts(candidate.scripts ?? get().scripts)
    const activeScriptId = candidate.activeScriptId && scripts.some((script) => script.manifest.id === candidate.activeScriptId) ? candidate.activeScriptId : scripts[0].manifest.id
    const sessions = { ...makeSessions(scripts), ...candidate.sessions }
    const providerConfig = migrateProviderConfig(candidate.providerConfig)
    const actionMode = isActionGenerationMode(candidate.actionMode) ? candidate.actionMode : 'guided'
    set({ scripts, sessions, activeScriptId, providerConfig, actionMode, activeNav: 'play', lastNotice: { type: 'success', message: '存档已导入，当前世界已恢复。' } })
    persist({ sessions, activeScriptId, providerConfig, actionMode, scripts })
  },
  importScriptPackage: (input) => {
    const validation = validateScriptPackage(input)
    if (!validation.valid) {
      set({ lastNotice: { type: 'error', message: `剧本包校验失败：${validation.errors.slice(0, 2).join('；')}` } })
      return false
    }
    const script = input as ScriptPackage
    set((state) => {
      const scripts = [...state.scripts.filter((item) => item.manifest.id !== script.manifest.id), script]
      const sessions = { ...state.sessions, [script.manifest.id]: state.sessions[script.manifest.id] ?? { scriptId: script.manifest.id, state: buildInitialState(script) } }
      persist({ ...state, scripts, sessions, activeScriptId: script.manifest.id })
      return { scripts, sessions, activeScriptId: script.manifest.id, activeNav: 'play' as NavKey, lastAction: null, lastNotice: { type: 'success', message: `剧本「${script.manifest.title}」已加载。` } }
    })
    return true
  },
  getExportPayload: () => {
    const { sessions, activeScriptId, providerConfig, actionMode, scripts } = get()
    return { format: 'ai-life-world-save', version: 1, exportedAt: new Date().toISOString(), sessions, activeScriptId, providerConfig, actionMode, scripts }
  },
}))
