export type NavKey = 'play' | 'character' | 'people' | 'history' | 'map' | 'settings'

export type ActionOutcome = 'success' | 'partial' | 'refused' | 'failed' | 'unknown'

export type ActionGenerationMode = 'guided' | 'varied' | 'freeform'

export type ConditionOperator = 'min' | 'max' | 'equals' | 'includes' | 'not-includes'

export interface RuleCondition {
  path: string
  operator: ConditionOperator
  value: string | number | boolean
  message?: string
}

export interface ActionRule {
  id: string
  conditions?: RuleCondition[]
  allowedLocations?: string[]
  blockedMessage?: string
  delayedEventId?: string
}

export interface ScheduledEvent {
  id: string
  dueTurn: number
  title: string
  body: string
  tags: string[]
  fact?: string
  npcId?: string
  relationshipDelta?: number
}

export interface CharacterCreationConfig {
  enabled: boolean
  roles: string[]
  professions: string[]
  traits: string[]
}

export interface ThemeTokens {
  accent: string
  accentSoft: string
  accentWarm: string
  ink: string
  paper: string
  surface: string
  sky: string
}

export interface PlayerState {
  name: string
  age: number
  role: string
  profession: string
  mood: string
  health: number
  stamina: number
  money: number
  reputation: number
  traits: string[]
}

export interface NpcState {
  id: string
  name: string
  role: string
  avatar: string
  summary: string
  relationship: number
  lastInteraction: string
  status: string
  schedule?: string[]
}

export interface LocationState {
  id: string
  name: string
  kind: string
  description: string
  distance: string
  available: boolean
}

export interface SuggestedAction {
  id: string
  ruleId?: string
  title: string
  description: string
  location: string
  timeCost: number
  moneyCost: number
  staminaCost: number
  risk: string
  tone: 'sage' | 'gold' | 'sky' | 'coral'
}

export interface EventLog {
  id: string
  actionId?: string
  ruleId?: string
  date: string
  title: string
  body: string
  outcome: ActionOutcome
  tags: string[]
  stateDiff?: StateDiff[]
}

export interface StateDiff {
  key: string
  label: string
  before: string | number
  after: string | number
}

export interface WorldState {
  day: number
  time: string
  season: string
  weather: string
  location: string
  region: string
  atmosphere: string
  headline: string
  narrative: string[]
  currentFocus: string
  publicNews: string[]
}

export interface GameState {
  player: PlayerState
  world: WorldState
  npcs: NpcState[]
  locations: LocationState[]
  suggestedActions: SuggestedAction[]
  history: EventLog[]
  inventory: string[]
  knownFacts: string[]
  scheduledEvents?: ScheduledEvent[]
  turn: number
}

export interface ScriptPackage {
  manifest: {
    id: string
    title: string
    subtitle: string
    version: string
    author: string
    description: string
    capabilities: string[]
  }
  theme: ThemeTokens
  characterCreation?: CharacterCreationConfig
  rules?: Record<string, ActionRule>
  events?: ScheduledEvent[]
  world: {
    startingLocation: string
    opening: string[]
    seedState: GameState
  }
}

export interface GameSession {
  scriptId: string
  state: GameState
}

export interface ProviderConfig {
  endpoint: string
  apiKey: string
  model: string
}

export interface ActionResult {
  outcome: ActionOutcome
  title: string
  narrative: string[]
  feedback: string
  timeLabel: string
  deltas: string[]
  stateDiff?: StateDiff[]
  state: GameState
}

export interface ActionSummary {
  outcome: ActionOutcome
  title: string
  feedback: string
  timeLabel: string
  deltas: string[]
  stateDiff?: StateDiff[]
}
