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
    expect(current.sessions['western-world::default'].state.turn).toBe(0)
    expect(current.sessions['western-world::default'].state.world.day).toBe(1)
    expect(current.sessions['western-world::default'].state.history).toHaveLength(0)
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

  it('starts a baby life with a clean calendar, baseline resources, and age-safe actions', () => {
    vi.stubGlobal('window', {})
    useGameStore.setState({ activeScriptId: 'western-world', activeLifeId: 'western-world::default', activeNav: 'character' })
    useGameStore.getState().startNewLife({ mapId: 'tide-harbor', ageStage: 'baby', player: { name: '小小旅人', age: 0 } })

    const session = useGameStore.getState().sessions[useGameStore.getState().activeLifeId]
    expect(session.state.player.age).toBe(0)
    expect(session.state.player.ageStage).toBe('baby')
    expect(session.state.player.profession).toBe('尚未拥有职业')
    expect(session.state.player.health).toBe(30)
    expect(session.state.player.maxHealth).toBe(30)
    expect(session.state.player.stamina).toBe(25)
    expect(session.state.player.maxStamina).toBe(25)
    expect(session.state.world.day).toBe(1)
    expect(session.state.world.time).toBe('清晨 · 07:00')
    expect(session.state.history).toHaveLength(0)
    expect(session.state.inventory).toHaveLength(0)
    expect(session.state.suggestedActions.every((action) => action.ruleId?.startsWith('baby-'))).toBe(true)
    expect(session.state.suggestedActions.some((action) => action.title.includes('码头') || action.title.includes('关店'))).toBe(false)
    expect(session.state.npcs.every((npc) => npc.met === false)).toBe(true)
  })

  it('migrates an old unplayed save so seeded NPC relationships are not restored', () => {
    vi.stubGlobal('window', {})
    const legacyState = structuredClone(getScript('western-world').world.seedState)
    legacyState.player.age = 0
    legacyState.player.ageStage = 'baby'
    legacyState.turn = 0
    legacyState.history = []
    legacyState.knownFacts = []
    legacyState.npcs = legacyState.npcs.map((npc) => ({ ...npc, relationship: 30, lastInteraction: '旧存档残留关系' }))

    useGameStore.getState().importRuntime({
      format: 'ai-life-world-save',
      version: 2,
      activeScriptId: 'western-world',
      activeLifeId: 'legacy',
      sessions: { legacy: { scriptId: 'western-world', state: legacyState, snapshots: [{ turn: 0, state: legacyState }] } },
      providerConfig: { endpoint: '', apiKey: '', model: '' },
    })

    const current = useGameStore.getState()
    const session = current.sessions[current.activeLifeId]
    expect(session.state.player.age).toBe(0)
    expect(session.state.npcs.every((npc) => npc.relationship === 0 && npc.lastInteraction === '尚未相遇')).toBe(true)
    expect(session.state.npcs.every((npc) => npc.met === false)).toBe(true)
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

  it('ignores malformed snapshots instead of crashing import', () => {
    vi.stubGlobal('window', {})
    const validState = structuredClone(getScript('dawnmere').world.seedState)
    const malformedNpcState = { ...structuredClone(validState), npcs: [{ id: 'broken' }] }
    const duplicateEventState = { ...structuredClone(validState), scheduledEvents: [{ id: 'dup', dueTurn: validState.turn + 1, title: '第一件事', body: '一件待发生的小事。', tags: [] }, { id: 'dup', dueTurn: validState.turn + 2, title: '第二件事', body: '另一件待发生的小事。', tags: [] }] }
    useGameStore.getState().importRuntime({
      format: 'ai-life-world-save',
      version: 2,
      activeScriptId: 'dawnmere',
      sessions: { dawnmere: { scriptId: 'dawnmere', state: validState, snapshots: [{ turn: 1, state: { player: { age: 0 }, world: {}, turn: 1 } }, { turn: 2, state: malformedNpcState }, { turn: 3, state: duplicateEventState }] } },
      providerConfig: { endpoint: '', apiKey: '', model: '' },
    })

    const current = useGameStore.getState()
    const session = current.sessions[current.activeLifeId]
    expect(session.snapshots).toHaveLength(1)
    expect(session.state.player.ageStage).toBe('adult')
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

  it('queues a validated AI incident without letting the model write game state', async () => {
    vi.stubGlobal('window', {})
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.stubGlobal('fetch', vi.fn(async (_input: unknown, init?: { body?: unknown }) => {
      const payload = JSON.parse(String(init?.body)) as { messages?: Array<{ content?: string }> }
      const system = payload.messages?.[0]?.content ?? ''
      if (system.includes('突发事件候选助手')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ incident: { title: '窗外传来三声铃', body: '夜风里传来三声短促的铃响，附近的人都停下了手里的事。', kind: 'encounter', tags: ['环境'], dueInTurns: 1 } }) } }] }), { status: 200 })
      if (system.includes('行动候选助手')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ actions: [] }) } }] }), { status: 200 })
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ narrative: ['第一段', '第二段'] }) } }] }), { status: 200 })
    }))
    useGameStore.setState({ activeScriptId: 'western-world', activeLifeId: 'western-world::default', activeNav: 'play', providerConfig: { endpoint: 'https://example.test/v1/chat/completions', apiKey: 'test', model: 'test' } })
    useGameStore.getState().startNewLife({ ageStage: 'adult', player: { name: '突发事件测试' } })
    await useGameStore.getState().runAction('整理工具和窗边')
    randomSpy.mockRestore()

    const session = useGameStore.getState().sessions[useGameStore.getState().activeLifeId]
    expect(session.state.scheduledEvents?.some((event) => event.title === '窗外传来三声铃')).toBe(true)
    expect(session.state.player.money).toBe(20)
  })
})
