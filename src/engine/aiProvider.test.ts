import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkProviderConnection, generateIncident, generateNarration } from './aiProvider'
import { buildInitialState } from './actionEngine'
import { getScript } from '../data/scripts'

const provider = { endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', apiKey: 'test-key-only', model: 'glm-4.7-flash' }

afterEach(() => vi.unstubAllGlobals())

describe('checkProviderConnection', () => {
  it('保留智谱 1305 的服务器原文和业务错误码', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 1305, message: '该模型当前访问量过大，请您稍后再试' } }), { status: 429 })))

    const result = await checkProviderConnection(provider)

    expect(result).toEqual({ ok: false, message: '服务器反馈：该模型当前访问量过大，请您稍后再试（HTTP 429，业务错误码 1305）' })
  })

  it('保留智谱周限额错误的服务器原文和业务错误码', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 1310, message: '您已达到每周使用上限，您的限额将在下周重置' } }), { status: 429 })))

    const result = await checkProviderConnection(provider)

    expect(result.message).toContain('您已达到每周使用上限，您的限额将在下周重置')
    expect(result.message).toContain('业务错误码 1310')
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

  it('accepts only bounded AI incident candidates tied to existing NPCs', async () => {
    const state = buildInitialState(getScript('western-world'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ incident: { title: '米拉送来一封短笺', body: '米拉让邻居捎来一封短笺，说她在集市听见了新的桥讯。', kind: 'encounter', tags: ['人物', '线索'], dueInTurns: 1, npcId: 'mira', relationshipDelta: 1 } }) } }] }), { status: 200 })))

    const result = await generateIncident(provider, { state, script: getScript('western-world') })
    expect(result?.npcId).toBe('mira')
    const request = vi.mocked(fetch).mock.calls[0]?.[1]
    expect(String(request?.body)).not.toContain('"player":{"name"')
  })
})
