import type { EventLog, GameState } from '../types'

function highestSequence(history: EventLog[]) {
  return history.reduce((highest, event) => {
    const sequence = event.sequence
    return typeof sequence === 'number' && Number.isInteger(sequence) && sequence > highest ? sequence : highest
  }, 0)
}

/** Adds a stable cursor to a newly-created event. */
export function appendEvent(state: GameState, event: EventLog) {
  const nextSequence = Math.max(1, state.nextEventSequence ?? highestSequence(state.history) + 1, highestSequence(state.history) + 1)
  state.nextEventSequence = nextSequence + 1
  state.history.unshift({ ...event, sequence: nextSequence })
}

/** Migrates legacy or partially migrated history without using wall-clock dates. */
export function normalizeEventLedger(state: GameState) {
  let previous = 0
  const chronological = [...state.history].reverse().map((event) => {
    const candidate = event.sequence
    const sequence = typeof candidate === 'number' && Number.isInteger(candidate) && candidate > previous ? candidate : previous + 1
    previous = sequence
    return { ...event, sequence }
  })
  state.history = chronological.reverse()
  state.nextEventSequence = Math.max(previous + 1, typeof state.nextEventSequence === 'number' && Number.isInteger(state.nextEventSequence) ? state.nextEventSequence : 0)
  return state
}

/** Returns events after a cursor in chronological order, including same-date events. */
export function eventsAfterSequence(state: GameState, cursor: number) {
  return [...state.history]
    .filter((event) => Number.isInteger(event.sequence) && (event.sequence as number) > cursor)
    .sort((left, right) => (left.sequence as number) - (right.sequence as number))
}
