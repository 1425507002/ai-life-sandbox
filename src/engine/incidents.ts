import type { GameState, IncidentCandidate, IncidentKind, ScheduledEvent, ScriptPackage } from '../types'

const KINDS: IncidentKind[] = ['opportunity', 'complication', 'encounter', 'weather']

function authorizedDiscoveryLocationIds(state: GameState, script: ScriptPackage) {
  const currentMap = script.maps?.find((map) => map.id === state.world.mapId)
  const currentMapLocationIds = new Set((currentMap?.seedState.locations ?? script.world.seedState.locations).map((location) => location.id))
  return new Set([
    ...Object.values(script.rules ?? {}).map((rule) => rule.revealsLocationId).filter((id): id is string => Boolean(id)),
    ...(script.events ?? []).map((event) => event.revealsLocationId).filter((id): id is string => Boolean(id)),
  ].filter((id) => currentMapLocationIds.has(id) && state.locations.some((location) => location.id === id)))
}

export function validateIncidentCandidate(candidate: unknown, state: GameState, script: ScriptPackage): candidate is IncidentCandidate {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false
  const item = candidate as Partial<IncidentCandidate>
  if (typeof item.title !== 'string' || item.title.trim().length < 2 || item.title.length > 100 || !/[A-Za-z0-9\u4e00-\u9fff]/.test(item.title)) return false
  if (typeof item.body !== 'string' || item.body.trim().length < 2 || item.body.length > 420) return false
  if (!KINDS.includes(item.kind as IncidentKind)) return false
  if (!Array.isArray(item.tags) || item.tags.length > 4 || !item.tags.every((tag) => typeof tag === 'string' && tag.length <= 24)) return false
  if (item.dueInTurns !== undefined && (!Number.isInteger(item.dueInTurns) || item.dueInTurns < 1 || item.dueInTurns > 3)) return false
  if (item.npcId !== undefined && (!state.npcs.some((npc) => npc.id === item.npcId && npc.met === true))) return false
  if (item.relationshipDelta !== undefined && (!Number.isInteger(item.relationshipDelta) || item.relationshipDelta < -2 || item.relationshipDelta > 2)) return false
  if (item.revealsLocationId !== undefined && !state.locations.some((location) => location.id === item.revealsLocationId)) return false
  const authorizedLocations = authorizedDiscoveryLocationIds(state, script)
  if (item.revealsLocationId !== undefined && !authorizedLocations.has(item.revealsLocationId)) return false
  return true
}

export function validateScheduledEvent(event: unknown, state: GameState, script: ScriptPackage): event is ScheduledEvent {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return false
  const item = event as Partial<ScheduledEvent>
  if (typeof item.id !== 'string' || item.id.trim().length < 2 || item.id.length > 120) return false
  if (!Number.isInteger(item.dueTurn) || (item.dueTurn ?? 0) <= state.turn || (item.dueTurn ?? 0) > state.turn + 100) return false
  if (typeof item.title !== 'string' || item.title.trim().length < 2 || item.title.length > 100) return false
  if (typeof item.body !== 'string' || item.body.trim().length < 2 || item.body.length > 420) return false
  if (!Array.isArray(item.tags) || item.tags.length > 5 || !item.tags.every((tag) => typeof tag === 'string' && tag.trim().length <= 24)) return false
  if (item.fact !== undefined && (typeof item.fact !== 'string' || item.fact.length > 200)) return false
  if (item.npcId !== undefined && !state.npcs.some((npc) => npc.id === item.npcId && npc.met === true)) return false
  if (item.relationshipDelta !== undefined && (!Number.isInteger(item.relationshipDelta) || item.relationshipDelta < -2 || item.relationshipDelta > 2)) return false
  if (item.revealsLocationId !== undefined && !state.locations.some((location) => location.id === item.revealsLocationId)) return false
  const authorizedLocations = authorizedDiscoveryLocationIds(state, script)
  if (item.revealsLocationId !== undefined && !authorizedLocations.has(item.revealsLocationId)) return false
  return true
}

function incidentId(candidate: IncidentCandidate, turn: number) {
  const slug = candidate.title.replace(/[^\u4e00-\u9fff\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'event'
  return `ai-incident-${turn}-${slug}`
}

export function queueIncidentCandidate(state: GameState, candidate: unknown, maxScheduled: number, script: ScriptPackage): { state: GameState; candidate: IncidentCandidate } | null {
  if (!validateIncidentCandidate(candidate, state, script)) return null
  const item = candidate as IncidentCandidate
  const scheduled = state.scheduledEvents ?? []
  if (scheduled.length >= maxScheduled || scheduled.some((event) => event.title === item.title)) return null
  const baseId = incidentId(item, state.turn)
  let eventId = baseId
  let suffix = 2
  while (scheduled.some((event) => event.id === eventId)) eventId = `${baseId}-${suffix++}`
  const event: ScheduledEvent = {
    id: eventId,
    dueTurn: state.turn + (item.dueInTurns ?? 1),
    title: item.title.trim(),
    body: item.body.trim(),
    tags: [...new Set([...item.tags.map((tag) => tag.trim()).filter(Boolean), 'AI候选'])].slice(0, 5),
    ...(item.npcId ? { npcId: item.npcId } : {}),
    ...(item.relationshipDelta ? { relationshipDelta: item.relationshipDelta } : {}),
    ...(item.revealsLocationId ? { revealsLocationId: item.revealsLocationId } : {}),
  }
  return { state: { ...structuredClone(state), scheduledEvents: [...scheduled, event] }, candidate: item }
}
