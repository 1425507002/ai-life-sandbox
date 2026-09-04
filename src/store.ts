import { create } from 'zustand'
import { buildInitialState, buildNewLifeState, resolveAction } from './engine/actionEngine'
import { generateActionCandidates, generateIncident, generateNarration, ZHIPU_FLASH_PROVIDER } from './engine/aiProvider'
import { queueIncidentCandidate, validateScheduledEvent } from './engine/incidents'
import { getAgeOptions, getAgeStageForAge, getAgeStageProfile } from './engine/ageRules'
import { generateSuggestedActions } from './engine/suggestionEngine'
import { scriptPackages } from './data/scripts'
import { loadRuntime, saveRuntime, validateRuntimePayload } from './storage'
import type { ActionGenerationMode, ActionSummary, GameSession, GameState, NavKey, NewLifeSetup, ProviderConfig, ScriptPackage } from './types'
import { validateScriptPackage, validateSuggestedAction } from './engine/scriptSchema'
import { isUiThemeId } from './uiThemes'
import type { UiThemeId } from './types'

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
  activeLifeId: string
  activeNav: NavKey
  providerConfig: ProviderConfig
  actionMode: ActionGenerationMode
  uiThemeId: UiThemeId
  hydrated: boolean
  lastAction: ActionSummary | null
  lastNotice: StoreNotice | null
  selectScript: (scriptId: string) => void
  selectLife: (lifeId: string) => void
  setNav: (nav: NavKey) => void
  setActionMode: (mode: ActionGenerationMode) => void
  setUiTheme: (themeId: UiThemeId) => void
  runAction: (input: string) => Promise<void>
  setProviderConfig: (config: Partial<ProviderConfig>) => void
  hydrate: () => Promise<void>
  resetSession: (scriptId?: string) => void
  rollbackLife: (turn: number) => void
  startNewLife: (setup?: NewLifeSetup) => void
  updatePlayer: (patch: Partial<GameState['player']>) => void
  clearNotice: () => void
  notify: (notice: StoreNotice) => void
  importRuntime: (runtime: unknown) => void
  importScriptPackage: (script: unknown) => boolean
  getExportPayload: () => unknown
}

function defaultLifeId(scriptId: string) {
  return `${scriptId}::default`
}

function makeSessions(scripts: ScriptPackage[]): Record<string, GameSession> {
  return Object.fromEntries(scripts.map((script) => {
    const lifeId = defaultLifeId(script.manifest.id)
    const state = buildInitialState(script)
    return [lifeId, { lifeId, scriptId: script.manifest.id, label: '默认人生', state, snapshots: [{ turn: state.turn, state }] }]
  }))
}

function legacyMapId(scriptId: string) {
  return scriptId === 'tideglass' ? 'tide-harbor' : scriptId === 'dawnmere' ? 'mist-town' : undefined
}

function resolveActiveLifeId(sessions: Record<string, GameSession>, activeScriptId: string, requestedLifeId?: string, requestedScriptId?: string) {
  if (requestedLifeId && sessions[requestedLifeId]?.scriptId === activeScriptId) return requestedLifeId
  const migratedLife = requestedLifeId ? Object.values(sessions).find((session) => session.scriptId === activeScriptId && session.lifeId?.endsWith(requestedLifeId)) : undefined
  if (migratedLife?.lifeId) return migratedLife.lifeId
  const legacyMap = legacyMapId(requestedScriptId ?? '')
  const mapLife = legacyMap && (Object.values(sessions).find((session) => session.scriptId === activeScriptId && session.lifeId !== defaultLifeId(activeScriptId) && session.state.world.mapId === legacyMap) ?? Object.values(sessions).find((session) => session.scriptId === activeScriptId && session.state.world.mapId === legacyMap))
  return mapLife?.lifeId ?? Object.values(sessions).find((session) => session.scriptId === activeScriptId)?.lifeId ?? defaultLifeId(activeScriptId)
}

function normalizeSavedState(rawState: GameState, script: ScriptPackage, mapId?: string): GameState {
  const base = buildInitialState(script, mapId)
  const age = Number.isFinite(rawState.player.age) ? Math.max(0, Math.min(120, rawState.player.age)) : base.player.age
  const savedMapId = typeof rawState.world.mapId === 'string' ? rawState.world.mapId : mapId ?? script.world.startingMapId
  const isUnplayedLife = rawState.turn === 0 && Array.isArray(rawState.history) && rawState.history.length === 0 && Array.isArray(rawState.knownFacts) && rawState.knownFacts.length === 0
  const ageProfile = getAgeStageProfile(script, getAgeStageForAge(script, age))
  const defaultMaxHealth = Math.max(1, ageProfile.maxHealth ?? ageProfile.startingHealth ?? 100)
  const defaultMaxStamina = Math.max(1, ageProfile.maxStamina ?? ageProfile.startingStamina ?? 80)
  const healthMax = isUnplayedLife ? defaultMaxHealth : Math.max(defaultMaxHealth, rawState.player.maxHealth ?? base.player.maxHealth ?? rawState.player.health)
  const staminaMax = isUnplayedLife ? defaultMaxStamina : Math.max(defaultMaxStamina, rawState.player.maxStamina ?? base.player.maxStamina ?? rawState.player.stamina)
  const selectedMap = script.maps?.find((map) => map.id === savedMapId)
  const startingLocationName = (selectedMap?.startingLocation ?? base.world.location).split(' · ').at(-1)
  const startingLocationId = (Array.isArray(rawState.locations) ? rawState.locations : base.locations).find((location) => location.name === startingLocationName)?.id ?? base.locations[0]?.id
  const state: GameState = {
    ...base,
    ...rawState,
    player: {
      ...base.player,
      ...rawState.player,
      age,
      ageStage: getAgeStageForAge(script, age),
      health: isUnplayedLife ? Math.min(defaultMaxHealth, ageProfile.startingHealth ?? defaultMaxHealth) : Math.max(0, Math.min(healthMax, rawState.player.health)),
      maxHealth: healthMax,
      stamina: isUnplayedLife ? Math.min(defaultMaxStamina, ageProfile.startingStamina ?? defaultMaxStamina) : Math.max(0, Math.min(staminaMax, rawState.player.stamina)),
      maxStamina: staminaMax,
    },
    world: { ...base.world, ...rawState.world, mapId: savedMapId },
    npcs: Array.isArray(rawState.npcs)
      ? rawState.npcs.map((npc) => isUnplayedLife
        ? { ...npc, relationship: 0, lastInteraction: '尚未相遇', met: false }
        : { ...npc, met: npc.met ?? (npc.relationship !== 0 || npc.lastInteraction !== '尚未相遇') })
      : base.npcs,
    locations: Array.isArray(rawState.locations)
      ? rawState.locations.map((location) => isUnplayedLife
        ? location.id === startingLocationId
          ? { ...location, discovered: true, discoverySource: 'birth' as const, discoveredAtTurn: 0 }
          : { ...location, discovered: false, discoverySource: undefined, discoveredAtTurn: undefined }
        : { ...location, discovered: location.discovered ?? true })
      : base.locations,
    history: Array.isArray(rawState.history) ? rawState.history : [],
    inventory: Array.isArray(rawState.inventory) ? rawState.inventory : [],
    knownFacts: Array.isArray(rawState.knownFacts) ? rawState.knownFacts : [],
    scheduledEvents: [],
    memory: rawState.memory && typeof rawState.memory === 'object' ? rawState.memory : base.memory,
    turn: Number.isFinite(rawState.turn) ? Math.max(0, rawState.turn) : 0,
  }
  state.scheduledEvents = Array.isArray(rawState.scheduledEvents)
    ? rawState.scheduledEvents.filter((event) => validateScheduledEvent(event, state, script)).slice(0, 8)
    : []
  state.suggestedActions = generateSuggestedActions(state, script)
  return state
}

function hasUniqueIds(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  const ids = value.map((item) => item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>).id : undefined)
  return ids.every((id): id is string => typeof id === 'string' && id.trim().length > 0) && new Set(ids).size === ids.length
}

function hasValidStateCollections(candidate: Partial<GameState>): boolean {
  const npcsValid = Array.isArray(candidate.npcs) && candidate.npcs.every((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const npc = value as unknown as Record<string, unknown>
    return ['id', 'name', 'role', 'avatar', 'summary', 'lastInteraction', 'status'].every((key) => typeof npc[key] === 'string') && typeof npc.relationship === 'number' && Number.isFinite(npc.relationship) && (npc.met === undefined || typeof npc.met === 'boolean')
  })
  const locationsValid = Array.isArray(candidate.locations) && candidate.locations.every((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const location = value as unknown as Record<string, unknown>
    return ['id', 'name', 'kind', 'description', 'distance'].every((key) => typeof location[key] === 'string') && typeof location.available === 'boolean'
  })
  const historyValid = Array.isArray(candidate.history) && candidate.history.every((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const event = value as unknown as Record<string, unknown>
    return ['id', 'date', 'title', 'body', 'outcome'].every((key) => typeof event[key] === 'string') && Array.isArray(event.tags) && event.tags.every((tag) => typeof tag === 'string')
  })
  return npcsValid && locationsValid && historyValid
}

function isStateLike(value: unknown): value is GameState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<GameState>
  const player = candidate.player
  const world = candidate.world
  const playerValid = Boolean(player && typeof player === 'object' && typeof player.name === 'string' && typeof player.age === 'number' && Number.isFinite(player.age) && typeof player.role === 'string' && typeof player.profession === 'string' && typeof player.mood === 'string' && [player.health, player.stamina, player.money, player.reputation].every((item) => typeof item === 'number' && Number.isFinite(item)) && Array.isArray(player.traits) && player.traits.every((item) => typeof item === 'string'))
  const worldValid = Boolean(world && typeof world === 'object' && typeof world.day === 'number' && Number.isFinite(world.day) && typeof world.time === 'string' && typeof world.season === 'string' && typeof world.weather === 'string' && typeof world.location === 'string' && typeof world.region === 'string' && typeof world.atmosphere === 'string' && typeof world.headline === 'string' && typeof world.currentFocus === 'string' && Array.isArray(world.narrative) && world.narrative.every((item) => typeof item === 'string') && Array.isArray(world.publicNews) && world.publicNews.every((item) => typeof item === 'string'))
  const arraysValid = hasValidStateCollections(candidate) && Array.isArray(candidate.inventory) && candidate.inventory.every((item) => typeof item === 'string') && Array.isArray(candidate.knownFacts) && candidate.knownFacts.every((item) => typeof item === 'string') && Array.isArray(candidate.suggestedActions) && candidate.suggestedActions.every((item) => validateSuggestedAction(item))
  const scheduledEventsValid = candidate.scheduledEvents === undefined || (Array.isArray(candidate.scheduledEvents) && hasUniqueIds(candidate.scheduledEvents))
  return Boolean(playerValid && worldValid && arraysValid && scheduledEventsValid && typeof candidate.turn === 'number' && Number.isFinite(candidate.turn) && hasUniqueIds(candidate.npcs) && hasUniqueIds(candidate.locations) && hasUniqueIds(candidate.history) && hasUniqueIds(candidate.suggestedActions))
}

function normalizeSessions(raw: unknown, scripts: ScriptPackage[]): Record<string, GameSession> {
  const sessions = makeSessions(scripts)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return sessions
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const candidate = value as Partial<GameSession>
    const sourceScriptId = typeof candidate.scriptId === 'string' ? candidate.scriptId : key
    const scriptId = scripts.some((script) => script.manifest.id === sourceScriptId) ? sourceScriptId : sourceScriptId === 'dawnmere' || sourceScriptId === 'tideglass' ? 'western-world' : undefined
    const script = scriptId ? scripts.find((item) => item.manifest.id === scriptId) : undefined
    if (!script || !scriptId || !isStateLike(candidate.state)) return
    const sourceLifeId = typeof candidate.lifeId === 'string' ? candidate.lifeId : `${scriptId}::legacy-${key}`
    const lifeId = sourceLifeId.startsWith(`${scriptId}::`) ? sourceLifeId : `${scriptId}::${sourceLifeId}`
    const mapId = candidate.state.world?.mapId ?? legacyMapId(sourceScriptId) ?? script.world.startingMapId
    const state = normalizeSavedState(candidate.state, script, mapId)
    const validSnapshots = Array.isArray(candidate.snapshots)
      ? candidate.snapshots.filter((snapshot) => Boolean(snapshot && typeof snapshot.turn === 'number' && isStateLike(snapshot.state)))
      : []
    const snapshots = validSnapshots.length
      ? validSnapshots.slice(-25).map((snapshot) => ({
        turn: snapshot.turn,
        state: normalizeSavedState(snapshot.state, script, snapshot.state.world?.mapId ?? mapId),
      }))
      : [{ turn: state.turn, state }]
    sessions[lifeId] = { lifeId, scriptId, label: candidate.label ?? '迁移的人生', state, snapshots }
  })
  return sessions
}

function mergeScripts(scripts: unknown): ScriptPackage[] {
  const custom = Array.isArray(scripts)
    ? scripts.filter((script) => {
      if (!validateScriptPackage(script).valid) return false
      const id = (script as Partial<ScriptPackage>).manifest?.id
      return id !== 'dawnmere' && id !== 'tideglass'
    }) as ScriptPackage[]
    : []
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

function persist(state: Pick<GameStore, 'sessions' | 'activeScriptId' | 'activeLifeId' | 'providerConfig' | 'actionMode' | 'uiThemeId' | 'scripts'>) {
  void saveRuntime({ sessions: state.sessions, activeScriptId: state.activeScriptId, activeLifeId: state.activeLifeId, providerConfig: state.providerConfig, actionMode: state.actionMode, uiThemeId: state.uiThemeId, scripts: state.scripts })
}

export const useGameStore = create<GameStore>((set, get) => ({
  scripts: scriptPackages,
  sessions: makeSessions(scriptPackages),
  activeScriptId: 'western-world',
  activeLifeId: defaultLifeId('western-world'),
  activeNav: 'play',
  providerConfig: DEFAULT_PROVIDER,
  actionMode: 'guided',
  uiThemeId: 'paper-journal',
  hydrated: false,
  lastAction: null,
  lastNotice: null,
  selectScript: (scriptId) => set((state) => {
    if (!state.scripts.some((script) => script.manifest.id === scriptId)) return state
    const existing = Object.values(state.sessions).find((session) => session.scriptId === scriptId)
    const lifeId = existing?.lifeId ?? defaultLifeId(scriptId)
    const script = findScript(state.scripts, scriptId)
    const initialState = buildInitialState(script)
    const sessions = existing ? state.sessions : { ...state.sessions, [lifeId]: { lifeId, scriptId, label: '默认人生', state: initialState, snapshots: [{ turn: initialState.turn, state: initialState }] } }
    const next = { ...state, sessions, activeScriptId: scriptId, activeLifeId: lifeId, activeNav: 'play' as NavKey }
    persist(next)
    return { ...next, lastNotice: null }
  }),
  selectLife: (lifeId) => set((state) => {
    const session = state.sessions[lifeId]
    if (!session) return state
    const next = { ...state, activeScriptId: session.scriptId, activeLifeId: lifeId, activeNav: 'play' as NavKey, lastAction: null, lastNotice: null }
    persist(next)
    return next
  }),
  setNav: (activeNav) => set({ activeNav }),
  setActionMode: (actionMode) => set((state) => {
    persist({ ...state, actionMode })
    return { actionMode }
  }),
  setUiTheme: (uiThemeId) => set((state) => {
    persist({ ...state, uiThemeId })
    return { uiThemeId }
  }),
  runAction: async (input) => {
    const { activeScriptId, activeLifeId, sessions, providerConfig, scripts } = get()
    const script = findScript(scripts, activeScriptId)
    const session = sessions[activeLifeId]
    if (!session) return
    const result = resolveAction(session.state, input, script)
    const requestIncident = result.outcome !== 'refused' && Boolean(script.incidentPolicy?.enabled && providerConfig.apiKey.trim() && providerConfig.endpoint.trim() && providerConfig.model.trim() && session.state.turn % 4 === 0 && Math.random() < (script.incidentPolicy?.chance ?? 0))
    const [maybeNarrative, maybeCandidates, maybeIncident] = result.outcome !== 'refused' ? await Promise.all([
      generateNarration(providerConfig, { input, result: result.narrative, state: result.state }),
      generateActionCandidates(providerConfig, { state: result.state, script, localCandidates: result.state.suggestedActions }),
      requestIncident ? generateIncident(providerConfig, { state: result.state, script }) : Promise.resolve(null),
    ]) : [null, null, null] as const
    const incidentResult = maybeIncident ? queueIncidentCandidate(result.state, maybeIncident, script.incidentPolicy?.maxScheduled ?? 8, script) : null
    const resolvedState = incidentResult?.state ?? result.state
    const finalState: GameState = {
      ...resolvedState,
      ...(maybeNarrative ? { world: { ...resolvedState.world, narrative: maybeNarrative } } : {}),
      ...(maybeCandidates ? { suggestedActions: maybeCandidates } : {}),
    }
    const snapshots = [...(session.snapshots ?? [{ turn: session.state.turn, state: session.state }]), { turn: finalState.turn, state: finalState }].slice(-25)
    const latest = get()
    const latestSession = latest.sessions[activeLifeId]
    if (latest.activeScriptId !== activeScriptId || latest.activeLifeId !== activeLifeId || !latestSession || latestSession.state.turn !== session.state.turn) return
    const nextSessions = { ...latest.sessions, [activeLifeId]: { ...latestSession, state: finalState, snapshots } }
    const aiConfigured = Boolean(providerConfig.apiKey.trim() && providerConfig.endpoint.trim() && providerConfig.model.trim())
    const lastNotice = aiConfigured && !maybeNarrative && !maybeCandidates && !incidentResult
      ? { type: 'error' as const, message: '规则已完成，但 AI 服务未响应；已使用本地行动和叙事。' }
      : maybeNarrative || maybeCandidates || incidentResult ? { type: 'success' as const, message: incidentResult ? `行动已结算，AI 提议了一件待发生的小事：${incidentResult.candidate.title}` : '行动已结算，AI 候选与叙事已按规则接入。' } : null
    set({ sessions: nextSessions, lastAction: { title: result.title, feedback: result.feedback, outcome: result.outcome, timeLabel: result.timeLabel, deltas: result.deltas, stateDiff: result.stateDiff }, lastNotice })
    persist({ sessions: nextSessions, activeScriptId, activeLifeId, providerConfig, actionMode: get().actionMode, uiThemeId: get().uiThemeId, scripts })
  },
  setProviderConfig: (config) => set((state) => {
    const providerConfig = { ...state.providerConfig, ...config }
    persist({ ...state, providerConfig })
    return { providerConfig }
  }),
  updatePlayer: (patch) => set((state) => {
    const session = state.sessions[state.activeLifeId]
    if (!session) return state
    const script = findScript(state.scripts, session.scriptId)
    const selectedMap = script.maps?.find((map) => map.id === session.state.world.mapId)
    const draftPlayer = { ...session.state.player, ...patch }
    const ageStage = getAgeStageForAge(script, draftPlayer.age)
    const options = getAgeOptions(script, selectedMap, ageStage)
    const nextPlayer = {
      ...draftPlayer,
      ageStage,
      ...(options.roles.length && !options.roles.includes(draftPlayer.role) ? { role: options.roles[0] } : {}),
      ...(options.professions.length && !options.professions.includes(draftPlayer.profession) ? { profession: options.professions[0] } : {}),
    }
    const nextState = { ...session.state, player: nextPlayer }
    const snapshots = [...(session.snapshots ?? [{ turn: session.state.turn, state: session.state }])]
    if (snapshots.length && snapshots[snapshots.length - 1].turn === nextState.turn) snapshots[snapshots.length - 1] = { turn: nextState.turn, state: nextState }
    const sessions = { ...state.sessions, [state.activeLifeId]: { ...session, state: nextState, snapshots } }
    persist({ ...state, sessions })
    return { sessions, lastNotice: { type: 'success', message: '角色档案已保存到本地。' } }
  }),
  clearNotice: () => set({ lastNotice: null }),
  notify: (lastNotice) => set({ lastNotice }),
  hydrate: async () => {
    const runtime = await loadRuntime()
    const scripts = mergeScripts(runtime?.scripts)
    const sessions = normalizeSessions(runtime?.sessions, scripts)
    const requestedScriptId = runtime?.activeScriptId === 'dawnmere' || runtime?.activeScriptId === 'tideglass' ? 'western-world' : runtime?.activeScriptId
    const activeScriptId = requestedScriptId && scripts.some((script) => script.manifest.id === requestedScriptId) ? requestedScriptId : scripts[0].manifest.id
    const activeLifeId = resolveActiveLifeId(sessions, activeScriptId, runtime?.activeLifeId, runtime?.activeScriptId)
    set({ scripts, sessions, activeScriptId, activeLifeId, providerConfig: migrateProviderConfig(runtime?.providerConfig), actionMode: isActionGenerationMode(runtime?.actionMode) ? runtime.actionMode : 'guided', uiThemeId: isUiThemeId(runtime?.uiThemeId) ? runtime.uiThemeId : 'paper-journal', hydrated: true, lastNotice: null })
  },
  resetSession: (scriptId = get().activeScriptId) => set((state) => {
    const script = findScript(state.scripts, scriptId)
    const activeSession = Object.values(state.sessions).find((session) => session.scriptId === scriptId && session.lifeId === state.activeLifeId) ?? Object.values(state.sessions).find((session) => session.scriptId === scriptId)
    const lifeId = activeSession?.lifeId ?? defaultLifeId(scriptId)
    const resetState = buildNewLifeState(script, { mapId: activeSession?.state.world.mapId, ageStage: 'adult', player: { name: '未命名人生', age: 18, traits: [] } })
    const sessions = { ...state.sessions, [lifeId]: { lifeId, scriptId, label: activeSession?.label ?? '默认人生', state: resetState, snapshots: [{ turn: resetState.turn, state: resetState }] } }
    persist({ ...state, sessions, activeLifeId: lifeId })
    return { sessions, activeScriptId: scriptId, activeLifeId: lifeId, activeNav: 'play', lastAction: null, lastNotice: { type: 'info', message: '当前人生已经重新开始。' } }
  }),
  startNewLife: (setup = {}) => set((state) => {
    const scriptId = setup.scriptId ?? state.activeScriptId
    const script = findScript(state.scripts, scriptId)
    const selectedMap = script.maps?.find((map) => map.id === setup.mapId)
    const newState = buildNewLifeState(script, setup)
    const baseLifeId = `${scriptId}::life-${Date.now()}`
    let lifeId = baseLifeId
    let suffix = 2
    while (state.sessions[lifeId]) lifeId = `${baseLifeId}-${suffix++}`
    const sessions = { ...state.sessions, [lifeId]: { lifeId, scriptId, label: newState.player.name || '未命名人生', state: newState, snapshots: [{ turn: newState.turn, state: newState }] } }
    persist({ ...state, sessions, activeScriptId: scriptId, activeLifeId: lifeId })
    return { sessions, activeScriptId: scriptId, activeLifeId: lifeId, activeNav: 'play', lastAction: null, lastNotice: { type: 'success', message: `新人生已从${selectedMap?.title ?? '当前世界'}开始。` } }
  }),
  rollbackLife: (turn) => set((state) => {
    const session = state.sessions[state.activeLifeId]
    if (!session) return state
    const snapshots = session.snapshots ?? [{ turn: session.state.turn, state: session.state }]
    const target = [...snapshots].reverse().find((snapshot) => snapshot.turn <= turn)
    if (!target || target.turn >= session.state.turn) return { lastNotice: { type: 'info', message: '当前已经是这条人生的最早记录。' } }
    const nextSession = { ...session, state: structuredClone(target.state), snapshots: snapshots.filter((snapshot) => snapshot.turn <= target.turn) }
    const sessions = { ...state.sessions, [state.activeLifeId]: nextSession }
    persist({ ...state, sessions })
    return { sessions, activeNav: 'play', lastAction: null, lastNotice: { type: 'success', message: `已回到第 ${target.turn} 次记录，之后的变化被保留为未发生。` } }
  }),
  importRuntime: (runtime) => {
    if (!runtime || typeof runtime !== 'object') return
    if (!validateRuntimePayload(runtime)) {
      set({ lastNotice: { type: 'error', message: '存档格式或版本不受支持，未导入任何内容。' } })
      return
    }
    const candidate = runtime as Partial<{ sessions: Record<string, GameSession>; activeScriptId: string; activeLifeId: string; providerConfig: ProviderConfig; actionMode: ActionGenerationMode; uiThemeId: UiThemeId; scripts: ScriptPackage[] }>
    const scripts = mergeScripts(candidate.scripts ?? get().scripts)
    const requestedScriptId = candidate.activeScriptId === 'dawnmere' || candidate.activeScriptId === 'tideglass' ? 'western-world' : candidate.activeScriptId
    const activeScriptId = requestedScriptId && scripts.some((script) => script.manifest.id === requestedScriptId) ? requestedScriptId : scripts[0].manifest.id
    const sessions = normalizeSessions(candidate.sessions, scripts)
    const activeLifeId = resolveActiveLifeId(sessions, activeScriptId, candidate.activeLifeId, candidate.activeScriptId)
    const providerConfig = migrateProviderConfig(candidate.providerConfig)
    const actionMode = isActionGenerationMode(candidate.actionMode) ? candidate.actionMode : 'guided'
    const uiThemeId = isUiThemeId(candidate.uiThemeId) ? candidate.uiThemeId : get().uiThemeId
    set({ scripts, sessions, activeScriptId, activeLifeId, providerConfig, actionMode, uiThemeId, activeNav: 'play', lastNotice: { type: 'success', message: '存档已导入，当前世界已恢复。' } })
    persist({ sessions, activeScriptId, activeLifeId, providerConfig, actionMode, uiThemeId, scripts })
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
      const lifeId = defaultLifeId(script.manifest.id)
      const initialState = buildInitialState(script)
      const sessions = { ...state.sessions, [lifeId]: state.sessions[lifeId] ?? { lifeId, scriptId: script.manifest.id, label: '默认人生', state: initialState, snapshots: [{ turn: initialState.turn, state: initialState }] } }
      persist({ ...state, scripts, sessions, activeScriptId: script.manifest.id, activeLifeId: lifeId })
      return { scripts, sessions, activeScriptId: script.manifest.id, activeLifeId: lifeId, activeNav: 'play' as NavKey, lastAction: null, lastNotice: { type: 'success', message: `剧本「${script.manifest.title}」已加载。` } }
    })
    return true
  },
  getExportPayload: () => {
    const { sessions, activeScriptId, activeLifeId, providerConfig, actionMode, uiThemeId, scripts } = get()
    return { format: 'ai-life-world-save', version: 2, exportedAt: new Date().toISOString(), sessions, activeScriptId, activeLifeId, providerConfig, actionMode, uiThemeId, scripts }
  },
}))
