export type NavKey = 'play' | 'character' | 'people' | 'history' | 'map' | 'settings'

export type ActionOutcome = 'success' | 'partial' | 'refused' | 'failed' | 'unknown'

export type ActionGenerationMode = 'guided' | 'varied' | 'freeform'

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
  date: string
  title: string
  body: string
  outcome: ActionOutcome
  tags: string[]
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
  state: GameState
}

export interface ActionSummary {
  outcome: ActionOutcome
  title: string
  feedback: string
  timeLabel: string
  deltas: string[]
}
