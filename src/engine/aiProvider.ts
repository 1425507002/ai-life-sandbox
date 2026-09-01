import type { GameState, ProviderConfig, ScriptPackage, SuggestedAction } from '../types'
import { validateSuggestedAction } from './scriptSchema'

export const ZHIPU_FLASH_PROVIDER: ProviderConfig = {
  endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  apiKey: '',
  model: 'glm-4.7-flash',
}

export interface ProviderConnectionResult {
  ok: boolean
  message: string
  latencyMs?: number
}

type ProviderErrorPayload = {
  error?: { code?: string | number; message?: string }
  code?: string | number
  message?: string
}

const LOCAL_AI_PROXY_PATH = '/api/ai-proxy'

function normalizedEndpoint(endpoint: string) {
  return endpoint.trim().replace(/\/$/, '')
}

function localProxyPath(endpoint: string) {
  try {
    const hostname = new URL(endpoint).hostname.toLowerCase()
    if (hostname === 'open.bigmodel.cn') return `${LOCAL_AI_PROXY_PATH}/zhipu`
    if (hostname === 'api.deepseek.com') return `${LOCAL_AI_PROXY_PATH}/deepseek`
  } catch {
    return null
  }
  return null
}

function requestUrl(endpoint: string) {
  return import.meta.env.DEV ? localProxyPath(endpoint) ?? normalizedEndpoint(endpoint) : normalizedEndpoint(endpoint)
}

async function postCompletion(config: ProviderConfig, payload: Record<string, unknown>, signal?: AbortSignal) {
  return fetch(requestUrl(config.endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    signal,
    body: JSON.stringify(payload),
  })
}

function serverErrorMessage(status: number, payload: ProviderErrorPayload | null) {
  const providerMessage = payload?.error?.message?.trim()
    ? payload.error.message
    : payload?.message?.trim()
      ? payload.message
      : undefined
  const providerCode = payload?.error?.code ?? payload?.code
  if (!providerMessage) return `服务器返回 HTTP ${status}，但没有提供可识别的错误详情。`
  const codeNote = providerCode === undefined ? '' : `，业务错误码 ${providerCode}`
  return `服务器反馈：${providerMessage}（HTTP ${status}${codeNote}）`
}

export async function checkProviderConnection(config: ProviderConfig): Promise<ProviderConnectionResult> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先在此页面填写 API Key。' }
  if (!config.endpoint.trim() || !config.model.trim()) return { ok: false, message: '请先填写 Endpoint 和 Model。' }

  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await postCompletion(config, {
        model: config.model,
        temperature: 0,
        max_tokens: 32,
        messages: [
          { role: 'system', content: '你正在进行 API 连接测试。只回复：连接成功。' },
          { role: 'user', content: '请回复连接状态。' },
        ],
      }, controller.signal)
    const payload = await response.json().catch(() => null) as (ProviderErrorPayload & { choices?: Array<{ message?: { content?: string } }> }) | null
    if (!response.ok) return { ok: false, message: serverErrorMessage(response.status, payload) }
    if (!payload?.choices?.[0]?.message?.content) return { ok: false, message: '服务已响应，但返回格式无法识别。' }
    return { ok: true, message: `连接成功 · ${config.model}`, latencyMs: Date.now() - startedAt }
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? '连接超时（15 秒）。请检查代理、网络或服务地址；若 Key 错误，通常会返回 HTTP 401/403。'
      : '连接请求未到达模型服务，通常是本机代理、网络或服务地址问题；若 Key 错误，通常会返回 HTTP 401/403。'
    return { ok: false, message }
  } finally {
    clearTimeout(timer)
  }
}

export interface NarrationRequest {
  input: string
  result: string[]
  state: GameState
}

export async function generateNarration(config: ProviderConfig, request: NarrationRequest): Promise<string[] | null> {
  if (!config.apiKey.trim() || !config.endpoint.trim() || !config.model.trim()) return null
  try {
    const response = await postCompletion(config, {
        model: config.model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: '你是一个克制、连续、尊重游戏状态的中文人生模拟器叙事者。只润色已有事实，不新增资源、人物或结果。输出两段短叙事，每段不超过80字，用JSON数组返回。' },
          { role: 'user', content: JSON.stringify({ input: request.input, resolvedFacts: request.result, location: request.state.world.location, time: request.state.world.time, player: request.state.player }) },
        ],
        response_format: { type: 'json_object' },
      })
    if (!response.ok) return null
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content) as { narrative?: unknown }
    if (Array.isArray(parsed.narrative) && parsed.narrative.every((item) => typeof item === 'string')) return parsed.narrative as string[]
    return null
  } catch {
    return null
  }
}

export interface ActionCandidatesRequest {
  state: GameState
  script: ScriptPackage
  localCandidates: SuggestedAction[]
}

export async function generateActionCandidates(config: ProviderConfig, request: ActionCandidatesRequest): Promise<SuggestedAction[] | null> {
  if (!config.apiKey.trim() || !config.endpoint.trim() || !config.model.trim()) return null
  try {
    const ruleIds = new Set(request.localCandidates.map((action) => action.ruleId ?? action.id))
    const response = await postCompletion(config, {
        model: config.model,
        temperature: 0.85,
        messages: [
          { role: 'system', content: '你是 AI 人生模拟器的行动候选助手。只能基于给定 ruleId 生成候选文案，不得创造新规则、资源、人物、地点或成本逻辑。只返回 JSON 对象：{"actions":[...]}。每次最多 6 个行动。' },
          { role: 'user', content: JSON.stringify({ script: request.script.manifest.title, state: request.state, allowedRuleIds: [...ruleIds], localCandidates: request.localCandidates }) },
        ],
        response_format: { type: 'json_object' },
      })
    if (!response.ok) return null
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content) as { actions?: unknown }
    if (!Array.isArray(parsed.actions)) return null
    const seen = new Set<string>()
    const candidates = parsed.actions.filter((item): item is SuggestedAction => {
      if (!validateSuggestedAction(item)) return false
      const action = item as SuggestedAction
      const ruleId = action.ruleId ?? action.id
      if (!ruleIds.has(ruleId) || seen.has(action.title)) return false
      seen.add(action.title)
      return true
    }).map((action, index) => ({ ...action, id: `ai:${action.ruleId ?? action.id}:${request.state.turn}:${index}`, ruleId: action.ruleId ?? action.id }))
    return candidates.length ? candidates.slice(0, 6) : null
  } catch {
    return null
  }
}
