import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkProviderConnection } from './aiProvider'

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
})
