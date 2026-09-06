import { describe, expect, it } from 'vitest'
import { appendEvent, eventsAfterSequence, normalizeEventLedger } from './eventLedger'
import { buildNewLifeState } from './actionEngine'
import { getScript } from '../data/scripts'

describe('event ledger', () => {
  it('assigns monotonic cursors when several events share the same displayed date', () => {
    const state = buildNewLifeState(getScript('western-world'), { ageStage: 'adult', player: { name: '账本测试' } })
    appendEvent(state, { id: 'first', turn: 1, date: '第 1 日 · 清晨 · 07:00', title: '第一件事', body: '', outcome: 'success', tags: [] })
    appendEvent(state, { id: 'second', turn: 1, date: '第 1 日 · 清晨 · 07:00', title: '第二件事', body: '', outcome: 'success', tags: [] })

    expect(state.history.map((event) => event.sequence)).toEqual([2, 1])
    expect(eventsAfterSequence(state, 0).map((event) => event.id)).toEqual(['first', 'second'])
  })

  it('migrates legacy history and resumes after the highest sequence', () => {
    const state = buildNewLifeState(getScript('western-world'), { ageStage: 'adult', player: { name: '旧账本测试' } })
    state.history = [
      { id: 'newest', date: '同一时间', title: '后记', body: '', outcome: 'success', tags: [] },
      { id: 'older', date: '同一时间', title: '前记', body: '', outcome: 'success', tags: [] },
    ]
    normalizeEventLedger(state)
    expect(state.history.map((event) => event.sequence)).toEqual([2, 1])
    expect(state.nextEventSequence).toBe(3)
    appendEvent(state, { id: 'resumed', date: '同一时间', title: '续记', body: '', outcome: 'success', tags: [] })
    expect(state.history[0].sequence).toBe(3)
    expect(eventsAfterSequence(state, 2).map((event) => event.id)).toEqual(['resumed'])
  })
})
