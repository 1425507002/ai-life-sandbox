import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkProviderConnection, generateActionCandidates, generateIncident, generateNarration } from './aiProvider'
import { buildInitialState, buildNewLifeState } from './actionEngine'
import { getScript } from '../data/scripts'
import { classifyProviderFailure, extractCompletionText, parseJsonContent } from './providerContract'

const provider = { endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', apiKey: 'test-key-only', model: 'glm-4.7-flash' }

afterEach(() => vi.unstubAllGlobals())

describe('checkProviderConnection', () => {
  it('保留智谱 1305 的服务器原文和业务错误码', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 1305, message: '该模型当前访问量过大，请您稍后再试' } }), { status: 429 })))

    const result = await checkProviderConnection(provider)

    expect(result).toMatchObject({ ok: false, message: '服务器反馈：该模型当前访问量过大，请您稍后再试（HTTP 429，业务错误码 1305）', failure: { kind: 'rate-limit', providerCode: 1305, retryable: true } })
  })

  it('保留智谱周限额错误的服务器原文和业务错误码', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 1310, message: '您已达到每周使用上限，您的限额将在下周重置' } }), { status: 429 })))

    const result = await checkProviderConnection(provider)

    expect(result.message).toContain('您已达到每周使用上限，您的限额将在下周重置')
    expect(result.message).toContain('业务错误码 1310')
    expect(result.failure?.kind).toBe('quota')
  })

  it('支持顶层 message，并优先使用嵌套 error.message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: '顶层错误' }), { status: 500 })))
    const topLevel = await checkProviderConnection(provider)
    expect(topLevel.message).toContain('顶层错误')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: '嵌套错误' }, message: '顶层错误' }), { status: 500 })))
    const nested = await checkProviderConnection(provider)
    expect(nested.message).toContain('嵌套错误')
    expect(nested.message).not.toContain('顶层错误')
  })

  it('没有服务器错误详情时才使用本地兜底', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 503 })))
    const result = await checkProviderConnection(provider)
    expect(result.message).toBe('服务器返回 HTTP 503，但没有提供可识别的错误详情。')
  })

  it('忽略空的嵌套错误信息，并处理非 JSON 响应', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: '' }, message: '顶层错误' }), { status: 429 })))
    const topLevel = await checkProviderConnection(provider)
    expect(topLevel.message).toContain('顶层错误')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream failure', { status: 502 })))
    const nonJson = await checkProviderConnection(provider)
    expect(nonJson.message).toBe('服务器返回 HTTP 502，但没有提供可识别的错误详情。')
  })

  it('does not reflect an API key from an upstream error', async () => {
    const secret = 'test-secret-key-only'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 401, message: `invalid key ${secret}` } }), { status: 401 })))
    const result = await checkProviderConnection({ ...provider, apiKey: secret })
    expect(result.message).not.toContain(secret)
    expect(result.message).toContain('[已隐藏]')
  })

  it('keeps a provider business code when HTTP 200 has no error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 1305 } }), { status: 200 })))
    const result = await checkProviderConnection(provider)
    expect(result.message).toContain('业务错误码 1305')
    expect(result.failure).toMatchObject({ kind: 'rate-limit', providerCode: 1305 })
  })

  it('兼容常见的 completion 文本形状', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ text: '连接成功' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: [{ type: 'output_text', text: '连接' }, { type: 'text', text: '成功' }] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output: { choices: [{ message: { content: '嵌套成功' } }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: '原生成功' }] }), { status: 200 })))

    await expect(checkProviderConnection(provider)).resolves.toMatchObject({ ok: true })
    await expect(checkProviderConnection(provider)).resolves.toMatchObject({ ok: true })
    await expect(checkProviderConnection(provider)).resolves.toMatchObject({ ok: true })
    await expect(checkProviderConnection(provider)).resolves.toMatchObject({ ok: true })
  })

  it('reports a non-JSON HTTP 200 response as a format failure without echoing it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream body with private details', { status: 200 })))
    const result = await checkProviderConnection(provider)
    expect(result.message).toContain('非 JSON 响应')
    expect(result.message).not.toContain('private details')
  })

  it('HTTP 200 携带服务商错误时不再伪装成格式错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 1305, message: '该模型当前访问量过大' } }), { status: 200 })))
    const result = await checkProviderConnection(provider)
    expect(result.message).toContain('该模型当前访问量过大')
    expect(result.failure?.kind).toBe('rate-limit')
  })

  it('将服务器分类保留为诊断信息，但始终优先显示服务器原文', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 401, message: 'invalid api key' } }), { status: 401 })))
    const result = await checkProviderConnection(provider)
    expect(result.message).toContain('invalid api key')
    expect(result.failure).toMatchObject({ kind: 'auth', retryable: false, httpStatus: 401 })
  })

  it('sends a bounded memory packet instead of the full game state', async () => {
    const state = buildInitialState(getScript('western-world'))
    state.history = Array.from({ length: 30 }, (_, index) => ({ id: `old-${index}`, turn: 30 - index, date: '第 1 日 · 午后', title: `旧事 ${index}`, body: '旧事内容', outcome: 'success' as const, tags: ['测试'] }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ narrative: ['第一段', '第二段'] }) } }] }), { status: 200 })))

    const result = await generateNarration(provider, { input: '整理房间', result: ['已整理房间'], state })
    const request = vi.mocked(fetch).mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body)) as { messages: Array<{ content: string }> }
    const context = JSON.parse(body.messages[1].content) as { context: { recentHistory: unknown[]; memory: { summary: string } }; state?: unknown }

    expect(result).toEqual(['第一段', '第二段'])
    expect(context.context.recentHistory).toHaveLength(8)
    expect(context.context.memory.summary).toContain('旧事 8')
    expect(context.state).toBeUndefined()
  })

  it('accepts fenced JSON from a compatible model response', async () => {
    const state = buildInitialState(getScript('western-world'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '```json\n{"narrative":["第一段","第二段"]}\n```' } }] }), { status: 200 })))
    await expect(generateNarration(provider, { input: '整理房间', result: ['已整理房间'], state })).resolves.toEqual(['第一段', '第二段'])
  })

  it('accepts only bounded AI incident candidates tied to existing NPCs', async () => {
    const state = buildInitialState(getScript('western-world'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ incident: { title: '米拉送来一封短笺', body: '米拉让邻居捎来一封短笺，说她在集市听见了新的桥讯。', kind: 'encounter', tags: ['人物', '线索'], dueInTurns: 1, npcId: 'mira', relationshipDelta: 1 } }) } }] }), { status: 200 })))

    const result = await generateIncident(provider, { state, script: getScript('western-world') })
    expect(result?.npcId).toBe('mira')
    const request = vi.mocked(fetch).mock.calls[0]?.[1]
    expect(String(request?.body)).not.toContain('"player":{"name"')
  })

  it('gives incident generation only opaque IDs for undiscovered locations', async () => {
    const state = buildNewLifeState(getScript('western-world'), { mapId: 'mist-town', ageStage: 'adult', player: { name: '地图白名单测试' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ incident: null }) } }] }), { status: 200 })))

    await generateIncident(provider, { state, script: getScript('western-world') })
    const request = vi.mocked(fetch).mock.calls[0]?.[1]
    const body = String(request?.body)

    expect(body).toContain('discoverableLocationIds')
    expect(body).toContain('market')
    expect(body).not.toContain('晨雾集市')
  })

  it('rejects AI action copy that leaks an unknown person or place', async () => {
    const script = getScript('western-world')
    const state = buildNewLifeState(script, { mapId: 'mist-town', ageStage: 'adult', player: { name: '行动文案隐私测试' } })
    const local = state.suggestedActions.find((action) => action.ruleId === 'market')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ actions: [{ ...local, title: '去找米拉了解晨雾集市', description: '询问米拉最近的消息。' }] }) } }] }), { status: 200 })))

    const result = await generateActionCandidates(provider, { state, script, localCandidates: local ? [local] : [] })

    expect(result).toBeNull()
  })

  it('keeps local action costs authoritative over AI copy', async () => {
    const script = getScript('western-world')
    const state = buildInitialState(script)
    const local = state.suggestedActions[0]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ actions: [{ ...local, title: '改写后的行动', description: '只改文案', timeCost: 1, moneyCost: 0, staminaCost: 0, location: '伪造地点', risk: '几乎没有' }] }) } }] }), { status: 200 })))

    const result = await generateActionCandidates(provider, { state, script, localCandidates: [local] })

    expect(result?.[0]).toMatchObject({ title: '改写后的行动', timeCost: local.timeCost, moneyCost: local.moneyCost, staminaCost: local.staminaCost, location: local.location, risk: local.risk })
  })
})

describe('provider contract helpers', () => {
  it('recognizes nested native output and content shapes', () => {
    expect(extractCompletionText({ output: { choices: [{ message: { content: '嵌套成功' } }] } })).toBe('嵌套成功')
    expect(extractCompletionText({ content: [{ type: 'text', text: '数组成功' }] })).toBe('数组成功')
    expect(extractCompletionText({ choices: [{ message: { reasoning_content: '推理成功' } }] })).toBe('推理成功')
    expect(extractCompletionText({ candidates: [{ content: { parts: [{ text: '候选成功' }] } }] })).toBe('候选成功')
  })

  it('parses fenced JSON and rejects malformed output', () => {
    expect(parseJsonContent<{ actions: string[] }>('```json\n{"actions":["a"]}\n```')).toEqual({ actions: ['a'] })
    expect(parseJsonContent('{not-json')).toBeNull()
  })

  it('distinguishes quota from transient rate limiting', () => {
    expect(classifyProviderFailure(429, { error: { code: 1310, message: '每周使用上限' } }).kind).toBe('quota')
    expect(classifyProviderFailure(429, { error: { code: 1305, message: '访问量过大' } }).kind).toBe('rate-limit')
  })
})
