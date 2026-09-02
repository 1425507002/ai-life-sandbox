import type { ScriptPackage, SuggestedAction } from '../types'

type RecordLike = Record<string, unknown>

const isRecord = (value: unknown): value is RecordLike => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const hasKeys = (value: RecordLike, keys: string[]) => keys.every((key) => key in value)

function validateAction(input: unknown, path: string, errors: string[]) {
  if (!isRecord(input) || !hasKeys(input, ['id', 'title', 'description', 'location', 'timeCost', 'moneyCost', 'staminaCost', 'risk', 'tone'])) {
    errors.push(`${path} 缺少行动必填字段`)
    return
  }
  if (![input.id, input.title, input.description, input.location, input.risk, input.tone].every(isString)) errors.push(`${path} 的文本字段格式错误`)
  if (!['sage', 'gold', 'sky', 'coral'].includes(String(input.tone))) errors.push(`${path}.tone 不是受支持的主题类型`)
  if (![input.timeCost, input.moneyCost, input.staminaCost].every(isNumber)) errors.push(`${path} 的成本字段必须是数字`)
  if (isNumber(input.timeCost) && input.timeCost <= 0) errors.push(`${path}.timeCost 必须大于 0`)
  if (isNumber(input.moneyCost) && input.moneyCost < 0) errors.push(`${path}.moneyCost 不能小于 0`)
  if (isNumber(input.staminaCost) && input.staminaCost < 0) errors.push(`${path}.staminaCost 不能小于 0`)
}

function validateState(input: unknown, errors: string[]) {
  if (!isRecord(input) || !isRecord(input.player) || !isRecord(input.world)) {
    errors.push('world.seedState 必须包含 player 和 world')
    return
  }
  const player = input.player
  const world = input.world
  if (!isString(player.name) || !isNumber(player.age) || !isString(player.role) || !isString(player.profession) || !isString(player.mood)) errors.push('world.seedState.player 基础字段格式错误')
  if (![player.health, player.stamina, player.money, player.reputation].every(isNumber)) errors.push('world.seedState.player 数值字段格式错误')
  if (!Array.isArray(player.traits) || !player.traits.every(isString)) errors.push('world.seedState.player.traits 必须是字符串数组')
  if (!isNumber(world.day) || !isString(world.time) || !isString(world.season) || !isString(world.weather) || !isString(world.location) || !isString(world.region) || !isString(world.atmosphere) || !isString(world.headline) || !isString(world.currentFocus)) errors.push('world.seedState.world 基础字段格式错误')
  if (!Array.isArray(world.narrative) || !world.narrative.every(isString) || !Array.isArray(world.publicNews) || !world.publicNews.every(isString)) errors.push('world.seedState.world 文本数组格式错误')
  if (!Array.isArray(input.npcs) || !Array.isArray(input.locations) || !Array.isArray(input.suggestedActions) || !Array.isArray(input.history) || !Array.isArray(input.inventory) || !Array.isArray(input.knownFacts) || !isNumber(input.turn)) errors.push('world.seedState 缺少有效的集合字段')
  if (Array.isArray(input.suggestedActions)) input.suggestedActions.forEach((action, index) => validateAction(action, `world.seedState.suggestedActions[${index}]`, errors))
}

function validateMap(input: unknown, index: number, errors: string[]) {
  const path = `maps[${index}]`
  if (!isRecord(input) || !hasKeys(input, ['id', 'title', 'subtitle', 'description', 'region', 'kind', 'startingLocation', 'opening', 'seedState'])) {
    errors.push(`${path} 缺少地图必填字段`)
    return
  }
  if (![input.id, input.title, input.subtitle, input.description, input.region, input.kind, input.startingLocation].every(isString)) errors.push(`${path} 的文本字段格式错误`)
  if (!Array.isArray(input.opening) || !input.opening.every(isString)) errors.push(`${path}.opening 必须是字符串数组`)
  if (input.availableRoles !== undefined && (!Array.isArray(input.availableRoles) || !input.availableRoles.every(isString))) errors.push(`${path}.availableRoles 必须是字符串数组`)
  if (input.availableProfessions !== undefined && (!Array.isArray(input.availableProfessions) || !input.availableProfessions.every(isString))) errors.push(`${path}.availableProfessions 必须是字符串数组`)
  if (!isRecord(input.seedState)) errors.push(`${path}.seedState 必须是对象`)
  else validateState(input.seedState, errors)
}

export function validateSuggestedAction(input: unknown): input is SuggestedAction {
  const errors: string[] = []
  validateAction(input, 'action', errors)
  return errors.length === 0
}

export function validateScriptPackage(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!isRecord(input) || !isRecord(input.manifest) || !isRecord(input.theme) || !isRecord(input.world)) return { valid: false, errors: ['剧本包必须包含 manifest、theme 和 world'] }
  const manifest = input.manifest
  if (!hasKeys(manifest, ['id', 'title', 'subtitle', 'version', 'author', 'description', 'capabilities'])) errors.push('manifest 缺少必填字段')
  if (![manifest.id, manifest.title, manifest.subtitle, manifest.version, manifest.author, manifest.description].every(isString)) errors.push('manifest 文本字段格式错误')
  if (!Array.isArray(manifest.capabilities) || !manifest.capabilities.every(isString)) errors.push('manifest.capabilities 必须是字符串数组')
  const theme = input.theme
  if (!['accent', 'accentSoft', 'accentWarm', 'ink', 'paper', 'surface', 'sky'].every((key) => isString(theme[key]))) errors.push('theme 必须包含完整颜色 Token')
  const world = input.world
  if (!isString(world.startingLocation) || !Array.isArray(world.opening) || !world.opening.every(isString) || !isRecord(world.seedState)) errors.push('world 必须包含 startingLocation、opening 和 seedState')
  validateState(world.seedState, errors)
  if (input.characterCreation !== undefined) {
    const creation = input.characterCreation
    if (!isRecord(creation) || typeof creation.enabled !== 'boolean' || !Array.isArray(creation.roles) || !Array.isArray(creation.professions) || !Array.isArray(creation.traits)) errors.push('characterCreation 字段格式错误')
  }
  if (input.rules !== undefined && (!isRecord(input.rules) || Object.values(input.rules).some((rule) => !isRecord(rule) || !isString(rule.id)))) errors.push('rules 必须是以规则 ID 为键的对象')
  if (input.rules !== undefined && isRecord(input.rules)) {
    Object.values(input.rules).forEach((rule, index) => {
      if (isRecord(rule) && rule.allowedMapIds !== undefined && (!Array.isArray(rule.allowedMapIds) || !rule.allowedMapIds.every(isString))) errors.push(`rules[${index}].allowedMapIds 必须是字符串数组`)
    })
  }
  if (input.events !== undefined && (!Array.isArray(input.events) || input.events.some((event) => !isRecord(event) || !isString(event.id) || !isNumber(event.dueTurn) || !isString(event.title) || !isString(event.body) || !Array.isArray(event.tags)))) errors.push('events 中存在格式错误的延迟事件')
  if (input.maps !== undefined && (!Array.isArray(input.maps) || input.maps.length === 0)) errors.push('maps 必须是至少包含一张地图的数组')
  if (Array.isArray(input.maps)) input.maps.forEach((map, index) => validateMap(map, index, errors))
  if (world.startingMapId !== undefined && !isString(world.startingMapId)) errors.push('world.startingMapId 必须是字符串')
  return { valid: errors.length === 0, errors }
}

export function isScriptPackage(input: unknown): input is ScriptPackage {
  return validateScriptPackage(input).valid
}
