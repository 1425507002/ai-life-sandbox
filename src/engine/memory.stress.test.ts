import { describe, expect, it } from 'vitest'
import { buildInitialState } from './actionEngine'
import { buildMemoryPacket, compressMemory } from './memory'
import { getScript } from '../data/scripts'

const approxTokens = (value: string) => Math.ceil(value.length / 4)

describe.skipIf(process.env.RUN_MEMORY_STRESS !== '1')('long-context stress test', () => {
  it('keeps the AI packet bounded beyond three times the configured context window', () => {
    const contextTokens = Math.max(16_000, Number(process.env.AI_CONTEXT_TOKENS ?? 128_000))
    const targetTokens = Math.ceil(contextTokens * 3.1)
    const eventBody = 'A detailed historical event preserved for stress testing. '.repeat(8)
    const eventTokens = approxTokens(eventBody)
    const eventCount = Math.ceil(targetTokens / eventTokens)
    const state = buildInitialState(getScript('western-world'))
    state.turn = eventCount
    state.history = Array.from({ length: eventCount }, (_, index) => ({
      id: `stress-${index}`,
      turn: eventCount - index,
      date: `第 ${eventCount - index} 日 · 午后`,
      title: `压力测试事件 ${index}`,
      body: eventBody,
      outcome: 'success' as const,
      tags: ['stress'],
    }))
    state.knownFacts = Array.from({ length: 200 }, (_, index) => `长期事实 ${index}`)

    const packet = buildMemoryPacket({ ...state, memory: compressMemory(state) })
    const packetTokens = approxTokens(JSON.stringify(packet))
    expect(approxTokens(JSON.stringify(state))).toBeGreaterThan(contextTokens * 3)
    expect(packetTokens).toBeLessThan(Math.min(contextTokens * 0.1, 20_000))
    expect(packet.recentHistory).toHaveLength(8)
  })
})
