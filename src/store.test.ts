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

    useGameStore.getState().updatePlayer({ profession: '木匠学徒' })
    const edited = useGameStore.getState().sessions[useGameStore.getState().activeLifeId]
    expect(harbor?.availableProfessions).toContain(edited.state.player.profession)
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

  it('migrates legacy map saves to the matching life and caps imported snapshots', () => {
    vi.stubGlobal('window', {})
    const legacyState = structuredClone(getScript('dawnmere').world.seedState)
    const snapshots = Array.from({ length: 40 }, (_, index) => ({ turn: index + 1, state: legacyState }))
    useGameStore.getState().importRuntime({
      format: 'ai-life-world-save',
      version: 2,
      activeScriptId: 'dawnmere',
      sessions: { dawnmere: { scriptId: 'dawnmere', state: legacyState, snapshots } },
      providerConfig: { endpoint: '', apiKey: '', model: '' },
    })

    const current = useGameStore.getState()
    expect(current.activeScriptId).toBe('western-world')
    expect(current.sessions[current.activeLifeId].state.world.mapId).toBe('mist-town')
    expect(current.activeLifeId).not.toBe('western-world::default')
    expect(current.sessions[current.activeLifeId].snapshots).toHaveLength(25)
    expect(current.sessions[current.activeLifeId].snapshots?.every((snapshot) => snapshot.state.world.mapId === 'mist-town')).toBe(true)
  })

  it('does not write an AI result into a life changed while the request was pending', async () => {
    vi.stubGlobal('window', {})
    let release: (response: Response) => void = () => undefined
    const pending = new Promise<Response>((resolve) => { release = resolve })
    vi.stubGlobal('fetch', vi.fn(() => pending))
    useGameStore.setState({ activeScriptId: 'western-world', activeLifeId: 'western-world::default', providerConfig: { endpoint: 'https://example.test/v1/chat/completions', apiKey: 'test', model: 'test' } })
    const originalTurn = useGameStore.getState().sessions['western-world::default'].state.turn
    const running = useGameStore.getState().runAction('整理工具和窗边')
    useGameStore.getState().startNewLife({ player: { name: '等待中的新人生' } })
    const changedLifeId = useGameStore.getState().activeLifeId
    release(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ narrative: ['不会写回旧人生'] }) } }] }), { status: 200 }))
    await running

    const current = useGameStore.getState()
    expect(current.activeLifeId).toBe(changedLifeId)
    expect(current.sessions['western-world::default'].state.turn).toBe(originalTurn)
    expect(current.lastAction).toBeNull()
  })
})
