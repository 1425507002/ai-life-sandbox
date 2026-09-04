import type { GameState, MemoryState } from '../types'

export const RECENT_HISTORY_LIMIT = 8
export const MEMORY_SUMMARY_LIMIT = 1800
const MEMORY_EVENT_ID_LIMIT = 128
const INVENTORY_LIMIT = 40
const NPC_LIMIT = 24
const LOCATION_LIMIT = 32
const TRAIT_LIMIT = 12
const TEXT_LIMIT = 240
const HISTORY_BODY_LIMIT = 360

function oneLine(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function clip(text: string, limit = TEXT_LIMIT) {
  const normalized = oneLine(text)
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}

function makeSummary(state: GameState, newlyCompressed: GameState['history']) {
  const previous = state.memory?.summary ? `${state.memory.summary}\n` : ''
  const additions = newlyCompressed
    .slice(0, 24)
    .reverse()
    .map((event) => `第${event.turn ?? '?'}次｜${clip(event.title, 80)}：${clip(event.body, HISTORY_BODY_LIMIT)}`)
    .join('\n')
  return `${previous}${additions}`.trim().slice(-MEMORY_SUMMARY_LIMIT)
}

export function compressMemory(state: GameState): MemoryState {
  const olderHistory = state.history.slice(RECENT_HISTORY_LIMIT)
  const previousThrough = state.memory?.compressedThroughTurn ?? 0
  const previousEventIds = new Set(state.memory?.compressedEventIds ?? [])
  const newlyCompressed = olderHistory.filter((event) => event.turn === undefined ? !previousEventIds.has(event.id) : event.turn > previousThrough)
  const latestTurn = newlyCompressed.reduce((max, event) => Math.max(max, event.turn ?? 0), previousThrough)
  const compressedEventIds = [...previousEventIds, ...newlyCompressed.map((event) => event.id)].slice(-MEMORY_EVENT_ID_LIMIT)
  const scheduled = (state.scheduledEvents ?? []).map((event) => `第${event.dueTurn}次待处理：${clip(event.title, 100)}`)
  const unresolved = state.history.filter((event) => event.outcome === 'unknown').slice(0, 8).map((event) => `待确认：${clip(event.title, 100)}`)
  return {
    summary: newlyCompressed.length ? makeSummary(state, newlyCompressed) : state.memory?.summary ?? '',
    compressedThroughTurn: latestTurn,
    compressedEventIds,
    pinnedFacts: [...new Set(state.knownFacts.map((fact) => clip(fact, 160)))].filter(Boolean).slice(-24),
    openThreads: [...new Set([...scheduled, ...unresolved])].slice(0, 12),
  }
}

export interface MemoryPacket {
  memory: MemoryState
  current: {
    turn: number
    day: number
    time: string
    season: string
    weather: string
    location: string
    region: string
    currentFocus: string
    player: Pick<GameState['player'], 'name' | 'age' | 'ageStage' | 'role' | 'profession' | 'mood' | 'health' | 'stamina' | 'money' | 'reputation' | 'traits'>
    inventory: string[]
    npcs: Array<Pick<GameState['npcs'][number], 'id' | 'name' | 'role' | 'relationship' | 'lastInteraction' | 'status'>>
    locations: Array<Pick<GameState['locations'][number], 'id' | 'name' | 'kind' | 'available'>>
  }
  recentHistory: Array<Pick<GameState['history'][number], 'id' | 'turn' | 'date' | 'title' | 'body' | 'outcome' | 'tags'>>
}

export function buildMemoryPacket(state: GameState): MemoryPacket {
  const memory = compressMemory(state)
  const player = {
    name: clip(state.player.name, 80),
    age: state.player.age,
    ageStage: state.player.ageStage,
    role: clip(state.player.role, 80),
    profession: clip(state.player.profession, 100),
    mood: clip(state.player.mood, 120),
    health: state.player.health,
    stamina: state.player.stamina,
    money: state.player.money,
    reputation: state.player.reputation,
    traits: state.player.traits.slice(0, TRAIT_LIMIT).map((trait) => clip(trait, 80)),
  }
  return {
    memory,
    current: {
      turn: state.turn,
      day: state.world.day,
      time: clip(state.world.time),
      season: clip(state.world.season),
      weather: clip(state.world.weather),
      location: clip(state.world.location),
      region: clip(state.world.region),
      currentFocus: clip(state.world.currentFocus),
      player,
      inventory: state.inventory.slice(-INVENTORY_LIMIT).map((item) => clip(item, 120)),
      npcs: state.npcs.filter((npc) => npc.met !== false).slice(0, NPC_LIMIT).map(({ id, name, role, relationship, lastInteraction, status }) => ({ id: clip(id, 80), name: clip(name, 80), role: clip(role, 100), relationship, lastInteraction: clip(lastInteraction), status: clip(status) })),
      locations: state.locations.filter((location) => location.discovered !== false).slice(0, LOCATION_LIMIT).map(({ id, name, kind, available }) => ({ id: clip(id, 80), name: clip(name, 100), kind: clip(kind, 80), available })),
    },
    recentHistory: state.history.slice(0, RECENT_HISTORY_LIMIT).map(({ id, turn, date, title, body, outcome, tags }) => ({ id: clip(id, 80), turn, date: clip(date, 80), title: clip(title, 100), body: clip(body, HISTORY_BODY_LIMIT), outcome, tags: tags.slice(0, 8).map((tag) => clip(tag, 60)) })),
  }
}
