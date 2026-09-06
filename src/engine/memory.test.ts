import { describe, expect, it } from 'vitest'
import { buildInitialState, buildNewLifeState } from './actionEngine'
import { buildMemoryPacket, compressMemory } from './memory'
import { getScript } from '../data/scripts'

describe('long-term memory context', () => {
  it('compresses older history while retaining recent events and facts', () => {
    const state = buildInitialState(getScript('western-world'))
    state.turn = 50
    state.history = Array.from({ length: 50 }, (_, index) => ({
      id: `history-${index}`,
      turn: 50 - index,
      date: `第 ${50 - index} 日 · 午后`,
      title: `长期事件 ${index}`,
      body: `这是一段用于验证长期记忆压缩的详细事件内容 ${index}。`.repeat(8),
      outcome: 'success' as const,
      tags: ['测试'],
    }))
    state.knownFacts = Array.from({ length: 30 }, (_, index) => `事实 ${index}`)

    const memory = compressMemory(state)
    const repeated = compressMemory({ ...state, memory })
    const packet = buildMemoryPacket({ ...state, memory })
    const fullSize = JSON.stringify(state).length
    const packetSize = JSON.stringify(packet).length

    expect(memory.compressedThroughTurn).toBe(42)
    expect(memory.summary).toContain('长期事件 8')
    expect(memory.compressedEventIds).toHaveLength(42)
    expect(repeated.summary).toBe(memory.summary)
    expect(packet.recentHistory).toHaveLength(8)
    expect(packet.memory.pinnedFacts).toHaveLength(24)
    expect(packetSize).toBeLessThan(fullSize * 0.65)
    expect(packet.current.player.name).toBe(state.player.name)
  })

  it('caps imported or malformed large fields before they reach a model', () => {
    const state = buildInitialState(getScript('western-world'))
    state.inventory = Array.from({ length: 200 }, (_, index) => `物品-${index}-${'很长的描述'.repeat(40)}`)
    state.knownFacts = Array.from({ length: 200 }, (_, index) => `事实-${index}-${'很长的描述'.repeat(40)}`)
    state.npcs = Array.from({ length: 100 }, (_, index) => ({ ...state.npcs[0], id: `npc-${index}`, name: `人物-${index}-${'很长的名字'.repeat(20)}` }))
    state.locations = Array.from({ length: 100 }, (_, index) => ({ ...state.locations[0], id: `location-${index}`, name: `地点-${index}-${'很长的名字'.repeat(20)}` }))

    const packet = buildMemoryPacket(state)

    expect(packet.current.inventory).toHaveLength(40)
    expect(packet.current.npcs).toHaveLength(24)
    expect(packet.current.locations).toHaveLength(32)
    expect(packet.memory.pinnedFacts).toHaveLength(24)
    expect(JSON.stringify(packet).length).toBeLessThan(20_000)
  })

  it('does not re-add legacy history entries that have no turn number', () => {
    const state = buildInitialState(getScript('western-world'))
    state.history = Array.from({ length: 10 }, (_, index) => ({
      id: `legacy-${index}`,
      date: '旧记录',
      title: `旧事件 ${index}`,
      body: '旧事件内容',
      outcome: 'success' as const,
      tags: ['旧版'],
    }))

    const first = compressMemory(state)
    const second = compressMemory({ ...state, memory: first })

    expect(first.summary).toBe(second.summary)
    expect(second.compressedEventIds).toEqual(first.compressedEventIds)
  })

  it('uses the legacy turn cursor until an old save has a sequence cursor', () => {
    const state = buildInitialState(getScript('western-world'))
    state.history = [
      ...Array.from({ length: 8 }, (_, index) => ({ id: `recent-${index}`, sequence: 12 - index, turn: 3, date: '近期回合', title: `近期事件 ${index}`, body: '近期内容', outcome: 'success' as const, tags: [] })),
      { id: 'already-compressed', sequence: 2, turn: 2, date: '旧回合', title: '旧事件', body: '旧内容', outcome: 'success', tags: [] },
      { id: 'not-yet-compressed', sequence: 1, turn: 1, date: '更旧回合', title: '更旧事件', body: '更旧内容', outcome: 'success', tags: [] },
    ]

    const memory = compressMemory({
      ...state,
      memory: { summary: '已有旧摘要', compressedThroughTurn: 2, compressedEventIds: ['already-compressed'], pinnedFacts: [], openThreads: [] },
    })

    expect(memory.summary).toBe('已有旧摘要')
    expect(memory.compressedEventIds).not.toContain('not-yet-compressed')
    expect(memory.compressedThroughTurn).toBe(2)
  })

  it('keeps long legacy event ids stable after normalizing their stored length', () => {
    const state = buildInitialState(getScript('western-world'))
    const longId = '旧事件'.repeat(300)
    state.history = [
      ...Array.from({ length: 8 }, (_, index) => ({ id: `recent-${index}`, date: '近期', title: `近期事件 ${index}`, body: '近期内容', outcome: 'success' as const, tags: [] })),
      { id: longId, date: '旧回合', title: '超长 ID 旧事件', body: '旧内容', outcome: 'success', tags: [] },
    ]
    const legacyMemory = { summary: '已有摘要', compressedThroughTurn: 2, compressedEventIds: [longId], pinnedFacts: [], openThreads: [] }

    const first = compressMemory({ ...state, memory: legacyMemory })
    const second = compressMemory({ ...state, memory: first })

    expect(first.compressedThroughSequence).toBeUndefined()
    expect(first.summary).toBe('已有摘要')
    expect(second.summary).toBe(first.summary)
    expect(second.compressedEventIds).toEqual(first.compressedEventIds)
    expect((first.compressedEventIds ?? [])[0].length).toBeLessThanOrEqual(120)
  })

  it('continues a legacy turn cursor across same-turn events using known sequences', () => {
    const state = buildInitialState(getScript('western-world'))
    state.history = [
      ...Array.from({ length: 8 }, (_, index) => ({ id: `recent-${index}`, sequence: 10 - index, turn: 3, date: '近期', title: `近期事件 ${index}`, body: '近期内容', outcome: 'success' as const, tags: [] })),
      { id: 'same-turn-new', sequence: 3, turn: 2, date: '旧回合', title: '同回合后续', body: '后续内容', outcome: 'success', tags: [] },
      { id: 'same-turn-known', sequence: 2, turn: 2, date: '旧回合', title: '同回合已记录', body: '已记录内容', outcome: 'success', tags: [] },
    ]
    const legacyMemory = { summary: '已有摘要', compressedThroughTurn: 2, compressedEventIds: ['same-turn-known'], pinnedFacts: [], openThreads: [] }

    const first = compressMemory({ ...state, memory: legacyMemory })
    const second = compressMemory({ ...state, memory: first })

    expect(first.summary).toContain('同回合后续')
    expect(first.compressedThroughSequence).toBeUndefined()
    expect(second.summary).toBe(first.summary)
  })

  it('keeps long ids with the same prefix distinct', () => {
    const state = buildInitialState(getScript('western-world'))
    const prefix = '同一前缀'.repeat(40)
    const firstId = `${prefix}甲`
    const secondId = `${prefix}乙`
    state.history = [
      ...Array.from({ length: 8 }, (_, index) => ({ id: `recent-${index}`, date: '近期', title: `近期事件 ${index}`, body: '近期内容', outcome: 'success' as const, tags: [] })),
      { id: firstId, date: '旧回合', title: '长 ID 甲', body: '甲', outcome: 'success', tags: [] },
      { id: secondId, date: '旧回合', title: '长 ID 乙', body: '乙', outcome: 'success', tags: [] },
    ]
    const memory = compressMemory({ ...state, memory: { summary: '', compressedThroughTurn: 0, compressedEventIds: [firstId], pinnedFacts: [], openThreads: [] } })

    expect(memory.summary).toContain('长 ID 乙')
    expect(memory.summary).not.toContain('长 ID 甲')
    expect(memory.compressedEventIds).toHaveLength(2)
  })

  it('bounds legacy summaries and individual compressed event ids', () => {
    const state = buildInitialState(getScript('western-world'))
    const memory = compressMemory({
      ...state,
      memory: {
        summary: '摘要'.repeat(3000),
        compressedThroughTurn: 100,
        compressedEventIds: ['事件'.repeat(3000)],
        pinnedFacts: [],
        openThreads: [],
      },
    })

    expect(memory.summary.length).toBeLessThanOrEqual(1000)
    expect((memory.compressedEventIds ?? []).every((id) => id.length <= 120)).toBe(true)
    expect(buildMemoryPacket({ ...state, memory }).memory.summary.length).toBeLessThanOrEqual(1000)
  })

  it('compresses multiple same-turn events by sequence instead of losing the later event', () => {
    const state = buildInitialState(getScript('western-world'))
    const recent = Array.from({ length: 8 }, (_, index) => ({ id: `recent-${index}`, sequence: 11 - index, turn: 3, date: '近期回合', title: `近期事件 ${index}`, body: '近期内容', outcome: 'success' as const, tags: [] }))
    state.history = [...recent,
      { id: 'same-turn-later', sequence: 3, turn: 2, date: '同一回合', title: '同回合后续', body: '后续内容', outcome: 'success', tags: [] },
      { id: 'same-turn-first', sequence: 2, turn: 2, date: '同一回合', title: '同回合前置', body: '前置内容', outcome: 'success', tags: [] },
    ]

    const memory = compressMemory(state)
    expect(memory.compressedThroughSequence).toBe(3)

    const withExistingMemory = compressMemory({
      ...state,
      memory: { ...memory, summary: '已有摘要', compressedThroughSequence: 2, compressedEventIds: ['same-turn-first'] },
    })
    expect(withExistingMemory.summary).toContain('同回合后续')
    expect(withExistingMemory.compressedEventIds).toContain('same-turn-later')
    expect(withExistingMemory.compressedThroughSequence).toBe(3)
  })

  it('does not leak undiscovered places or strangers into the AI context', () => {
    const state = buildNewLifeState(getScript('western-world'), { mapId: 'mist-town', ageStage: 'adult', player: { name: '上下文边界测试' } })
    const packet = buildMemoryPacket(state)

    expect(packet.current.locations.map((location) => location.id)).toEqual(['home'])
    expect(packet.current.npcs).toHaveLength(0)
  })
})
