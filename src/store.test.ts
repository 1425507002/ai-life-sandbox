import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './store'
import { getScript } from './data/scripts'
import * as storage from './storage'
import { AI_ENHANCEMENT_TIMEOUT_MS } from './engine/aiProvider'

afterEach(() => vi.unstubAllGlobals())

async function flushBackgroundEnhancement() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

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

  it('loads the verified urban script without changing the western baseline life', () => {
    vi.stubGlobal('window', {})
    const westernBefore = useGameStore.getState().sessions['western-world::default'].state

    useGameStore.getState().selectScript('urban-life')

    const current = useGameStore.getState()
    const urbanSession = current.sessions[current.activeLifeId]
    expect(current.activeScriptId).toBe('urban-life')
    expect(urbanSession.scriptId).toBe('urban-life')
    expect(urbanSession.state.world.mapId).toBe('old-bridge')
    expect(urbanSession.state.world.location).toBe('霓虹城 · 旧桥居所')
    expect(urbanSession.state.npcs.every((npc) => npc.met === false)).toBe(true)
    expect(useGameStore.getState().sessions['western-world::default'].state).toEqual(westernBefore)
  })

  it('starts a separate urban child life with one known location and age-safe choices', () => {
    vi.stubGlobal('window', {})
    useGameStore.getState().selectScript('urban-life')
    useGameStore.getState().startNewLife({ scriptId: 'urban-life', mapId: 'old-bridge', ageStage: 'child', player: { name: '旧桥小居民', age: 7 } })

    const current = useGameStore.getState()
    const session = current.sessions[current.activeLifeId]
    expect(session.scriptId).toBe('urban-life')
    expect(session.state.player.ageStage).toBe('child')
    expect(session.state.player.maxHealth).toBe(65)
    expect(session.state.player.maxStamina).toBe(45)
    expect(session.state.locations.filter((location) => location.discovered !== false)).toHaveLength(1)
    expect(session.state.npcs.every((npc) => npc.met === false && npc.relationship === 0)).toBe(true)
    expect(session.state.suggestedActions.every((action) => action.ruleId?.startsWith('child-'))).toBe(true)
  })

  it('keeps an AI script generation result as a preview until explicit package import', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ opening: ['新的都市清晨'], currentFocus: '从社区公告开始认识城市' }) } }] }), { status: 200 })))
    useGameStore.setState({ activeScriptId: 'urban-life', activeLifeId: 'urban-life::default', providerConfig: { endpoint: 'https://example.test/v1/chat/completions', apiKey: 'test', model: 'test' }, scriptDraft: null })
    const before = useGameStore.getState().sessions['urban-life::default'].state

    await useGameStore.getState().generateScriptStage('world')

    const preview = useGameStore.getState().scriptDraft
    expect(preview?.valid).toBe(true)
    expect(preview?.script?.world.opening).toEqual(['新的都市清晨'])
    expect(useGameStore.getState().sessions['urban-life::default'].state).toEqual(before)

    useGameStore.getState().clearScriptDraft()
    expect(useGameStore.getState().scriptDraft).toBeNull()
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
    const firstState = useGameStore.getState().sessions['western-world::default'].state
    const firstSequence = firstState.history[0].sequence
    expect(firstState.turn).toBe(before + 1)
    expect(firstState.history[0].input).toBe('整理工具和窗边')
    expect(firstSequence).toBeDefined()

    useGameStore.getState().rollbackLife(before)
    const current = useGameStore.getState()
    expect(current.sessions['western-world::default'].state.turn).toBe(before)
    expect(current.activeLifeId).toBe('western-world::default')

    await useGameStore.getState().runAction('整理工具和窗边')
    const replayed = useGameStore.getState().sessions['western-world::default'].state
    expect(replayed.history[0].sequence).toBeGreaterThan(firstSequence ?? 0)
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

  it('rejects a session with a non-string action input without changing the current save', () => {
    vi.stubGlobal('window', {})
    const before = useGameStore.getState().activeLifeId
    const validState = structuredClone(getScript('western-world').world.seedState)
    const malformedHistoryState = { ...structuredClone(validState), history: [{ ...validState.history[0], input: { forged: true } }] }

    useGameStore.getState().importRuntime({
      format: 'ai-life-world-save',
      version: 2,
      activeScriptId: 'western-world',
      sessions: { malformed: { scriptId: 'western-world', state: malformedHistoryState } },
      providerConfig: { endpoint: '', apiKey: '', model: '' },
    })

    const current = useGameStore.getState()
    expect(current.activeLifeId).toBe(before)
    expect(current.lastNotice?.type).toBe('error')
    expect(current.lastNotice?.message).toContain('损坏')
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
    await flushBackgroundEnhancement()

    const current = useGameStore.getState()
    expect(current.activeLifeId).toBe(changedLifeId)
    expect(current.sessions['western-world::default'].state.turn).toBe(originalTurn + 1)
    expect(current.lastAction).toBeNull()
  })

  it('does not overwrite a same-turn player edit while AI enhancement is pending', async () => {
    vi.stubGlobal('window', {})
    let release: (response: Response) => void = () => undefined
    const pending = new Promise<Response>((resolve) => { release = resolve })
    vi.stubGlobal('fetch', vi.fn(() => pending))
    useGameStore.setState({ activeScriptId: 'western-world', activeLifeId: 'western-world::default', providerConfig: { endpoint: 'https://example.test/v1/chat/completions', apiKey: 'test', model: 'test' } })
    const originalTurn = useGameStore.getState().sessions['western-world::default'].state.turn
    const running = useGameStore.getState().runAction('整理工具和窗边')
    useGameStore.getState().updatePlayer({ name: '同回合手动修改' })
    release(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ narrative: ['旧 AI 叙事'] }) } }] }), { status: 200 }))
    await running
    await flushBackgroundEnhancement()

    const current = useGameStore.getState()
    expect(current.sessions['western-world::default'].state.player.name).toBe('同回合手动修改')
    expect(current.sessions['western-world::default'].state.turn).toBe(originalTurn + 1)
  })

  it('explains an enhancement timeout while keeping the local settlement', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal('window', {})
      vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))
      useGameStore.setState({ activeScriptId: 'western-world', activeLifeId: 'western-world::default', providerConfig: { endpoint: 'https://example.test/v1/chat/completions', apiKey: 'test', model: 'test' } })

      const running = useGameStore.getState().runAction('整理工具和窗边')
      await vi.advanceTimersByTimeAsync(AI_ENHANCEMENT_TIMEOUT_MS + 1)
      await running

      const current = useGameStore.getState()
      const state = current.sessions['western-world::default'].state
      expect(state.turn).toBeGreaterThan(0)
      expect(state.world.narrative).toEqual(['AI 未返回本回合叙事。', '规则结果已保存；你可以继续选择已验证行动。'])
      expect(current.lastNotice?.message).toContain('AI 在')
      expect(current.lastNotice?.message).toContain('仅保留规则结算')
      expect(current.lastNotice?.message).toContain('未伪造 AI 内容')
      expect(current.lastNotice?.message).toContain(String(AI_ENHANCEMENT_TIMEOUT_MS))
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists the latest provider config after a delayed action completes', async () => {
    vi.stubGlobal('window', {})
    const saveSpy = vi.spyOn(storage, 'saveRuntime').mockResolvedValue(undefined)
    let release: (response: Response) => void = () => undefined
    const pending = new Promise<Response>((resolve) => { release = resolve })
    vi.stubGlobal('fetch', vi.fn(() => pending))
    useGameStore.setState({ activeScriptId: 'western-world', activeLifeId: 'western-world::default', providerConfig: { endpoint: 'https://example.test/v1/chat/completions', apiKey: 'test', model: 'old-model' } })

    const running = useGameStore.getState().runAction('整理工具和窗边')
    useGameStore.getState().setProviderConfig({ model: 'new-model' })
    release(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ narrative: ['延迟完成'] }) } }] }), { status: 200 }))
    await running
    await flushBackgroundEnhancement()

    const lastSaved = saveSpy.mock.calls.at(-1)?.[0]
    expect(lastSaved?.providerConfig.model).toBe('new-model')
    saveSpy.mockRestore()
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
    await flushBackgroundEnhancement()
    randomSpy.mockRestore()

    const session = useGameStore.getState().sessions[useGameStore.getState().activeLifeId]
    expect(session.state.scheduledEvents?.some((event) => event.title === '窗外传来三声铃')).toBe(true)
    expect(session.state.player.money).toBe(20)
  })
})
