import type { AgeStage, AgeStageDefinition, AgeStageProfile, GameState, MapDefinition, ScriptPackage, SuggestedAction } from '../types'

const DEFAULT_AGE_STAGES: AgeStageDefinition[] = [
  { id: 'baby', label: '婴儿期', minAge: 0, maxAge: 3, description: '需要照料，行动范围和成长节奏都很有限。' },
  { id: 'child', label: '童年期', minAge: 4, maxAge: 11, description: '可以玩耍、学习基础技能并建立最初的人际关系。' },
  { id: 'teen', label: '少年期', minAge: 12, maxAge: 17, description: '可以学习、拜师或开始承担有限的工作。' },
  { id: 'adult', label: '成年期', minAge: 18, maxAge: 59, description: '拥有完整的职业、迁居、交易和关系选择。' },
  { id: 'elder', label: '老年期', minAge: 60, maxAge: 120, description: '经验更丰富，但体力、健康和时间安排需要更谨慎。' },
]

const DEFAULT_PROFILES: Record<AgeStage, AgeStageProfile> = {
  baby: { startingHealth: 30, maxHealth: 30, startingStamina: 25, maxStamina: 25, startingMoney: 0, startingReputation: 0, startingInventory: [], startingMood: '需要照料' },
  child: { startingHealth: 65, maxHealth: 65, startingStamina: 45, maxStamina: 45, startingMoney: 2, startingReputation: 0, startingInventory: [], startingMood: '精力充沛' },
  teen: { startingHealth: 85, maxHealth: 85, startingStamina: 65, maxStamina: 65, startingMoney: 8, startingReputation: 0, startingInventory: ['简易随身包'], startingMood: '正在寻找方向' },
  adult: { startingHealth: 100, maxHealth: 100, startingStamina: 80, maxStamina: 80, startingMoney: 20, startingReputation: 0, startingInventory: ['简易随身包'], startingMood: '刚刚开始' },
  elder: { startingHealth: 85, maxHealth: 85, startingStamina: 55, maxStamina: 55, startingMoney: 30, startingReputation: 0, startingInventory: ['旧怀表'], startingMood: '沉静' },
}

export function getAgeStageDefinitions(script: ScriptPackage): AgeStageDefinition[] {
  return script.characterCreation?.ageStages?.length ? script.characterCreation.ageStages : DEFAULT_AGE_STAGES
}

export function getAgeStageForAge(script: ScriptPackage, age: number): AgeStage {
  const match = getAgeStageDefinitions(script).find((stage) => age >= stage.minAge && age <= stage.maxAge)
  return match?.id ?? 'adult'
}

export function getAgeStageDefinition(script: ScriptPackage, stage: AgeStage): AgeStageDefinition {
  return getAgeStageDefinitions(script).find((item) => item.id === stage) ?? DEFAULT_AGE_STAGES.find((item) => item.id === stage) ?? DEFAULT_AGE_STAGES[3]
}

export function getAgeStageProfile(script: ScriptPackage, stage: AgeStage): AgeStageProfile {
  return { ...DEFAULT_PROFILES[stage], ...(script.characterCreation?.ageStageProfiles?.[stage] ?? {}) }
}

export function clampAgeToStage(script: ScriptPackage, age: number, stage: AgeStage): number {
  const definition = getAgeStageDefinition(script, stage)
  return Math.max(definition.minAge, Math.min(definition.maxAge, Number.isFinite(age) ? age : definition.minAge))
}

export function getAgeOptions(script: ScriptPackage, map: MapDefinition | undefined, stage: AgeStage) {
  const profile = getAgeStageProfile(script, stage)
  const roles = profile.roles?.length ? profile.roles : map?.availableRoles?.length ? map.availableRoles : script.characterCreation?.roles ?? []
  const professions = profile.professions?.length ? profile.professions : map?.availableProfessions?.length ? map.availableProfessions : script.characterCreation?.professions ?? []
  return { roles: [...roles], professions: [...professions] }
}

export function isAgeAllowed(rule: { allowedAgeStages?: AgeStage[] } | undefined, state: GameState, script: ScriptPackage) {
  if (!rule?.allowedAgeStages?.length) return true
  const stage = getAgeStageForAge(script, state.player.age)
  return rule.allowedAgeStages.includes(stage)
}

export function ageActionsForState(script: ScriptPackage, state: GameState): SuggestedAction[] {
  const stage = getAgeStageForAge(script, state.player.age)
  return script.ageStageActions?.[stage] ?? []
}

export function blockedAgeMessage(stage: AgeStage) {
  const label: Record<AgeStage, string> = { baby: '婴儿期', child: '童年期', teen: '少年期', adult: '成年期', elder: '老年期' }
  return `你目前处于${label[stage]}，这项行动需要等到合适的年龄阶段。`
}
