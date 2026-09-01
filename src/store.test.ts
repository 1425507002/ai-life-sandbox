import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './store'
import { getScript } from './data/scripts'

afterEach(() => vi.unstubAllGlobals())

describe('game store', () => {
  it('returns to the playable scene when restarting the current life', () => {
    vi.stubGlobal('window', {})
    useGameStore.setState({ activeScriptId: 'dawnmere', activeNav: 'character' })

    useGameStore.getState().resetSession()

    const current = useGameStore.getState()
    expect(current.activeNav).toBe('play')
    expect(current.activeScriptId).toBe('dawnmere')
    expect(current.sessions.dawnmere.state.turn).toBe(getScript('dawnmere').world.seedState.turn)
    expect(current.lastAction).toBeNull()
  })
})
