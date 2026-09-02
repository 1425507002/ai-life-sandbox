import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './store'
import { getScript } from './data/scripts'

afterEach(() => vi.unstubAllGlobals())

describe('game store', () => {
  it('returns to the playable scene when restarting the current life', () => {
    vi.stubGlobal('window', {})
    useGameStore.setState({ activeScriptId: 'western-world', activeLifeId: 'western-world::default', activeNav: 'character' })

    useGameStore.getState().resetSession()

    const current = useGameStore.getState()
    expect(current.activeNav).toBe('play')
    expect(current.activeScriptId).toBe('western-world')
    expect(current.sessions['western-world::default'].state.turn).toBe(getScript('western-world').world.seedState.turn)
    expect(current.lastAction).toBeNull()
  })

  it('starts a separate life with the selected map and map-compatible profession', () => {
    vi.stubGlobal('window', {})
    useGameStore.setState({ activeScriptId: 'western-world', activeLifeId: 'western-world::default', activeNav: 'character' })
    const western = getScript('western-world')
    const harbor = western.maps?.find((map) => map.id === 'tide-harbor')

    useGameStore.getState().startNewLife({
      mapId: 'tide-harbor',
      player: { name: '新旅人', age: 19, profession: '不属于港口的职业' },
    })

    const current = useGameStore.getState()
    const session = current.sessions[current.activeLifeId]
    expect(current.activeLifeId).not.toBe('western-world::default')
    expect(session.label).toBe('新旅人')
    expect(session.state.world.mapId).toBe('tide-harbor')
    expect(session.state.world.region).toBe(harbor?.region)
    expect(harbor?.availableProfessions).toContain(session.state.player.profession)
  })

  it('switches UI themes without changing the active life', () => {
    vi.stubGlobal('window', {})
    const beforeLife = useGameStore.getState().activeLifeId
    useGameStore.getState().setUiTheme('twilight-library')
    const current = useGameStore.getState()
    expect(current.uiThemeId).toBe('twilight-library')
    expect(current.activeLifeId).toBe(beforeLife)
    expect((current.getExportPayload() as { uiThemeId: string }).uiThemeId).toBe('twilight-library')
  })

  it('keeps multiple lives addressable and can roll the active life back', async () => {
    vi.stubGlobal('window', {})
    useGameStore.setState({ activeScriptId: 'western-world', activeLifeId: 'western-world::default', activeNav: 'play' })
    const before = useGameStore.getState().sessions['western-world::default'].state.turn
    await useGameStore.getState().runAction('整理工具和窗边')
    expect(useGameStore.getState().sessions['western-world::default'].state.turn).toBe(before + 1)

    useGameStore.getState().rollbackLife(before)
    const current = useGameStore.getState()
    expect(current.sessions['western-world::default'].state.turn).toBe(before)
    expect(current.activeLifeId).toBe('western-world::default')
  })
})
