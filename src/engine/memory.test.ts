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

  it('does not leak undiscovered places or strangers into the AI context', () => {
    const state = buildNewLifeState(getScript('western-world'), { mapId: 'mist-town', ageStage: 'adult', player: { name: '上下文边界测试' } })
    const packet = buildMemoryPacket(state)

    expect(packet.current.locations.map((location) => location.id)).toEqual(['home'])
    expect(packet.current.npcs).toHaveLength(0)
  })
})
