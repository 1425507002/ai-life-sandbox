import type { AgeStage, ActionRule, CharacterCreationConfig, MapDefinition, ScriptPackage, ScheduledEvent, SuggestedAction } from '../types'
import { validateScriptPackage } from './scriptSchema'

export type ScriptGenerationStage = 'world' | 'maps' | 'characters' | 'actions' | 'events'

export interface ScriptGenerationPreferences {
  mapId?: string
  ageStage?: AgeStage
  experienceMode?: string
}

export interface ScriptGenerationRequest {
  stage: ScriptGenerationStage
  scriptId: string
  systemPrompt: string
  userPayload: Record<string, unknown>
  responseFormat: { type: 'json_object' }
  maxOutputTokens: number
}

export interface ScriptGenerationReport {
  valid: boolean
  stage: ScriptGenerationStage
  errors: string[]
  warnings: string[]
  changedKeys: string[]
  script?: ScriptPackage
}

type RecordLike = Record<string, unknown>

const STAGE_KEYS: Record<ScriptGenerationStage, string[]> = {
  world: ['opening', 'ageStageOpenings', 'publicNews', 'currentFocus', 'atmosphere'],
  maps: ['maps'],
  characters: ['characterCreation', 'npcs'],
  actions: ['ageStageActions', 'rules'],
  events: ['events', 'incidentPolicy'],
}

const STAGE_LIMITS: Record<ScriptGenerationStage, number> = {
  world: 1200,
  maps: 3000,
  characters: 2600,
  actions: 4200,
  events: 2600,
}

const STAGE_LABELS: Record<ScriptGenerationStage, string> = {
  world: '世界骨架',
  maps: '地图与地点',
  characters: '人物与身份',
  actions: '行动与规则',
  events: '事件与开场内容',
}

const isRecord = (value: unknown): value is RecordLike => Boolean(value && typeof value === 'object' && !Array.isArray(value))

function clone<T>(value: T): T {
  return structuredClone(value)
}

function hasOwn(value: RecordLike, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function collectText(value: unknown, path = ''): Array<{ path: string; value: string }> {
  if (typeof value === 'string') return [{ path, value }]
  if (Array.isArray(value)) return value.flatMap((item, index) => collectText(item, `${path}[${index}]`))
  if (isRecord(value)) return Object.entries(value).flatMap(([key, item]) => collectText(item, path ? `${path}.${key}` : key))
  return []
}

function validateStageShape(stage: ScriptGenerationStage, payload: unknown, errors: string[]) {
  if (!isRecord(payload)) {
    errors.push('AI_STAGE_FORMAT: 阶段输出必须是 JSON 对象。')
    return
  }
  const allowed = new Set(STAGE_KEYS[stage])
  Object.keys(payload).forEach((key) => {
    if (!allowed.has(key)) errors.push(`AI_STATE_WRITE: ${stage} 阶段不允许写入字段 ${key}。`)
  })
  if (!Object.keys(payload).some((key) => allowed.has(key))) errors.push(`AI_STAGE_EMPTY: ${STAGE_LABELS[stage]}没有可应用的内容。`)
  collectText(payload).forEach(({ path, value }) => {
    if (value.length > STAGE_LIMITS[stage]) errors.push(`AI_CONTENT_LENGTH: ${path} 超过当前阶段的文本长度上限。`)
  })
}

function validateReferences(script: ScriptPackage, errors: string[]) {
  const maps = script.maps ?? []
  const mapIds = new Set(maps.map((map) => map.id))
  const locationIds = new Set(maps.flatMap((map) => map.seedState.locations.map((location) => location.id)))
  const npcIds = new Set(maps.flatMap((map) => map.seedState.npcs.map((npc) => npc.id)))
  const ruleIds = new Set(Object.keys(script.rules ?? {}))

  Object.entries(script.ageStageActions ?? {}).forEach(([stage, actions]) => {
    ;(actions ?? []).forEach((action: SuggestedAction, index) => {
      if (action.ruleId && !ruleIds.has(action.ruleId)) errors.push(`AI_REFERENCE: ageStageActions.${stage}[${index}].ruleId ${action.ruleId} 未在 rules 注册。`)
    })
  })
  Object.values(script.rules ?? {}).forEach((rule: ActionRule) => {
    rule.allowedMapIds?.forEach((mapId) => {
      if (!mapIds.has(mapId)) errors.push(`AI_REFERENCE: rule ${rule.id} 引用了未知地图 ${mapId}。`)
    })
    if (rule.revealsLocationId && !locationIds.has(rule.revealsLocationId)) errors.push(`AI_REFERENCE: rule ${rule.id} 引用了未知地点 ${rule.revealsLocationId}。`)
  })
  script.events?.forEach((event: ScheduledEvent) => {
    if (event.npcId && !npcIds.has(event.npcId)) errors.push(`AI_REFERENCE: event ${event.id} 引用了未知 NPC ${event.npcId}。`)
    if (event.revealsLocationId && !locationIds.has(event.revealsLocationId)) errors.push(`AI_REFERENCE: event ${event.id} 引用了未知地点 ${event.revealsLocationId}。`)
  })
}

function applyPayload(script: ScriptPackage, stage: ScriptGenerationStage, payload: RecordLike): ScriptPackage {
  const next = clone(script)
  if (stage === 'world') {
    next.world = {
      ...next.world,
      opening: Array.isArray(payload.opening) ? payload.opening as string[] : next.world.opening,
      seedState: {
        ...next.world.seedState,
        world: {
          ...next.world.seedState.world,
          publicNews: Array.isArray(payload.publicNews) ? payload.publicNews as string[] : next.world.seedState.world.publicNews,
          currentFocus: typeof payload.currentFocus === 'string' ? payload.currentFocus : next.world.seedState.world.currentFocus,
          atmosphere: typeof payload.atmosphere === 'string' ? payload.atmosphere : next.world.seedState.world.atmosphere,
        },
      },
    }
    if (isRecord(payload.ageStageOpenings)) next.ageStageOpenings = payload.ageStageOpenings as ScriptPackage['ageStageOpenings']
  }
  if (stage === 'maps' && Array.isArray(payload.maps)) next.maps = payload.maps as MapDefinition[]
  if (stage === 'characters') {
    if (isRecord(payload.characterCreation)) next.characterCreation = payload.characterCreation as unknown as CharacterCreationConfig
    if (Array.isArray(payload.npcs)) next.world.seedState.npcs = payload.npcs as ScriptPackage['world']['seedState']['npcs']
  }
  if (stage === 'actions') {
    if (isRecord(payload.ageStageActions)) next.ageStageActions = payload.ageStageActions as ScriptPackage['ageStageActions']
    if (isRecord(payload.rules)) next.rules = payload.rules as ScriptPackage['rules']
  }
  if (stage === 'events') {
    if (Array.isArray(payload.events)) next.events = payload.events as ScheduledEvent[]
    if (isRecord(payload.incidentPolicy)) next.incidentPolicy = payload.incidentPolicy as ScriptPackage['incidentPolicy']
  }
  return next
}

export function getScriptGenerationStageLabel(stage: ScriptGenerationStage) {
  return STAGE_LABELS[stage]
}

export function buildScriptGenerationRequest(script: ScriptPackage, stage: ScriptGenerationStage, preferences: ScriptGenerationPreferences = {}): ScriptGenerationRequest {
  const allowedKeys = STAGE_KEYS[stage]
  return {
    stage,
    scriptId: script.manifest.id,
    maxOutputTokens: STAGE_LIMITS[stage],
    responseFormat: { type: 'json_object' },
    systemPrompt: `你是 AI Life Worlds 的${STAGE_LABELS[stage]}生成器。只生成当前剧本「${script.manifest.title}」允许的局部内容。只返回 JSON 对象，不要 Markdown。不得改变题材、manifest.id、核心规则、年龄边界、地图白名单或当前人生 GameState；不得创建未登记的资源、人物、地点或规则。输出字段只能是：${allowedKeys.join('、')}。所有引用必须使用输入提供的 ID。生成内容会经过 schema、引用完整性和长度校验，不合格内容不会加载。`,
    userPayload: {
      stage,
      script: { id: script.manifest.id, title: script.manifest.title, subtitle: script.manifest.subtitle, version: script.manifest.version },
      preferences,
      allowedKeys,
      allowedMapIds: script.maps?.map((map) => map.id) ?? [],
      allowedLocationIds: script.maps?.flatMap((map) => map.seedState.locations.map((location) => location.id)) ?? [],
      allowedNpcIds: script.maps?.flatMap((map) => map.seedState.npcs.map((npc) => npc.id)) ?? [],
      allowedRuleIds: Object.keys(script.rules ?? {}),
      outputContract: `只返回 ${STAGE_LABELS[stage]}阶段的 JSON 字段；不要返回 state、sessions、history、apiKey 或其它未声明字段。`,
    },
  }
}

export function applyScriptGenerationStage(script: ScriptPackage, stage: ScriptGenerationStage, payload: unknown): ScriptGenerationReport {
  const errors: string[] = []
  const warnings: string[] = []
  validateStageShape(stage, payload, errors)
  if (errors.length) return { valid: false, stage, errors, warnings, changedKeys: [] }

  const next = applyPayload(script, stage, payload as RecordLike)
  const packageValidation = validateScriptPackage(next)
  errors.push(...packageValidation.errors.map((error) => `AI_SCHEMA: ${error}`))
  validateReferences(next, errors)
  if (stage === 'characters' && next.world.seedState.npcs.some((npc) => npc.met === true || npc.relationship !== 0)) warnings.push('人物阶段只定义剧本人物，不会把 NPC 直接标记为玩家已相遇。')
  if (stage === 'events' && (next.events?.length ?? 0) > 8) warnings.push('运行时最多保留 8 条待处理事件，超出的事件不会进入队列。')
  return {
    valid: errors.length === 0,
    stage,
    errors,
    warnings,
    changedKeys: STAGE_KEYS[stage].filter((key) => isRecord(payload) && hasOwn(payload, key)),
    ...(errors.length === 0 ? { script: next } : {}),
  }
}
