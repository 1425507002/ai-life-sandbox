export type NavKey = 'play' | 'character' | 'people' | 'history' | 'map' | 'settings'

export type ActionOutcome = 'success' | 'partial' | 'refused' | 'failed' | 'unknown'

export type ActionGenerationMode = 'guided' | 'varied' | 'freeform'

export type AgeStage = 'baby' | 'child' | 'teen' | 'adult' | 'elder'

export interface AgeStageDefinition {
  id: AgeStage
  label: string
  minAge: number
  maxAge: number
  description: string
}

export interface AgeStageProfile {
  roles?: string[]
  professions?: string[]
  startingHealth?: number
  maxHealth?: number
  startingStamina?: number
  maxStamina?: number
  startingMoney?: number
  startingReputation?: number
  startingInventory?: string[]
  startingMood?: string
}

export type UiThemeId = 'paper-journal' | 'twilight-library' | 'field-notes' | 'harbor-postcard'

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
  allowedMapIds?: string[]
  allowedAgeStages?: AgeStage[]
  blockedMessage?: string
  delayedEventId?: string
  revealsLocationId?: string
}

export type IncidentKind = 'opportunity' | 'complication' | 'encounter' | 'weather'

export interface IncidentCandidate {
  title: string
  body: string
  kind: IncidentKind
  tags: string[]
  dueInTurns?: number
  npcId?: string
  relationshipDelta?: number
  revealsLocationId?: string
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
  revealsLocationId?: string
}

export interface CharacterCreationConfig {
  enabled: boolean
  roles: string[]
  professions: string[]
  traits: string[]
  ageStages?: AgeStageDefinition[]
  ageStageProfiles?: Partial<Record<AgeStage, AgeStageProfile>>
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
  ageStage?: AgeStage
  role: string
  profession: string
  mood: string
  health: number
  maxHealth: number
  stamina: number
  maxStamina: number
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
  met?: boolean
  schedule?: string[]
}

export interface LocationState {
  id: string
  name: string
  kind: string
  description: string
  distance: string
  available: boolean
  discovered?: boolean
  discoverySource?: 'birth' | 'exploration' | 'npc' | 'rumor' | 'event'
  discoveredAtTurn?: number
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
  turn?: number
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
  mapId?: string
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
  memory?: MemoryState
  turn: number
}

export interface MemoryState {
  summary: string
  compressedThroughTurn: number
  compressedEventIds?: string[]
  pinnedFacts: string[]
  openThreads: string[]
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
  ageStageActions?: Partial<Record<AgeStage, SuggestedAction[]>>
  maps?: MapDefinition[]
  rules?: Record<string, ActionRule>
  events?: ScheduledEvent[]
  incidentPolicy?: {
    enabled: boolean
    chance: number
    maxScheduled?: number
  }
  world: {
    startingLocation: string
    startingMapId?: string
    opening: string[]
    seedState: GameState
    mapDiscovery?: MapDiscoveryPolicy
  }
}

export interface MapDiscoveryPolicy {
  initialKnownLocation: 'startingLocation'
  allowedSources: Array<'birth' | 'exploration' | 'npc' | 'rumor' | 'event'>
  maxNewLocationsPerAction: number
  requireExplicitDiscovery: boolean
  aiMustNotCreateLocation: boolean
}

export interface MapDefinition {
  id: string
  title: string
  subtitle: string
  description: string
  region: string
  kind: string
  startingLocation: string
  opening: string[]
  availableRoles?: string[]
  availableProfessions?: string[]
  seedState: GameState
  discoveryPolicy?: MapDiscoveryPolicy
}

export interface GameSession {
  lifeId?: string
  scriptId: string
  label?: string
  state: GameState
  snapshots?: Array<{ turn: number; state: GameState }>
}

export interface ProviderConfig {
  endpoint: string
  apiKey: string
  model: string
}

export interface NewLifeSetup {
  scriptId?: string
  mapId?: string
  ageStage?: AgeStage
  player?: Partial<GameState['player']>
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
