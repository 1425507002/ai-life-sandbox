import type { GameState, IncidentCandidate, ProviderConfig, ScriptPackage, SuggestedAction } from '../types'
import { validateSuggestedAction } from './scriptSchema'
import { buildMemoryPacket } from './memory'
import { validateIncidentCandidate } from './incidents'
import { classifyProviderFailure, extractCompletionText, formatProviderFailure, normalizeProviderErrorPayload, parseJsonContent, type ProviderFailureInfo } from './providerContract'

export const ZHIPU_FLASH_PROVIDER: ProviderConfig = {
  endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  apiKey: '',
  model: 'glm-4.7-flash',
}

export const QWEN_FLASH_PROVIDER: ProviderConfig = {
  endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  apiKey: '',
  model: 'qwen-flash',
}

export interface ProviderConnectionResult {
  ok: boolean
  message: string
  latencyMs?: number
  failure?: ProviderFailureInfo
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
    if (hostname === 'dashscope.aliyuncs.com') return `${LOCAL_AI_PROXY_PATH}/qwen`
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

export async function checkProviderConnection(config: ProviderConfig): Promise<ProviderConnectionResult> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先在此页面填写 API Key。', failure: { kind: 'missing-config', retryable: false } }
  if (!config.endpoint.trim() || !config.model.trim()) return { ok: false, message: '请先填写 Endpoint 和 Model。', failure: { kind: 'missing-config', retryable: false } }

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
    const rawPayload = await response.json().catch(() => null)
    const payload = normalizeProviderErrorPayload(rawPayload)
    if (!response.ok) {
      const failure = classifyProviderFailure(response.status, payload)
      return { ok: false, message: formatProviderFailure(failure), failure }
    }
    if (!extractCompletionText(rawPayload)) return { ok: false, message: '服务已响应，但返回格式无法识别。', failure: { kind: 'bad-response', httpStatus: response.status, retryable: false } }
    return { ok: true, message: `连接成功 · ${config.model}`, latencyMs: Date.now() - startedAt }
  } catch (error) {
    const failure = error instanceof DOMException && error.name === 'AbortError'
      ? { kind: 'timeout' as const, retryable: true }
      : { kind: 'network' as const, retryable: true }
    const message = failure.kind === 'timeout'
      ? '连接超时（15 秒）。请检查代理、网络或服务地址；若 Key 错误，通常会返回 HTTP 401/403。'
      : '连接请求未到达模型服务，通常是本机代理、网络或服务地址问题；若 Key 错误，通常会返回 HTTP 401/403。'
    return { ok: false, message, failure }
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
          { role: 'system', content: '你是一个克制、连续、尊重游戏状态的中文人生模拟器叙事者。只润色已有事实，不新增资源、人物或结果。地图与人物也遵守已知边界：未在 context 中出现的地点和人物不能被写成玩家已知或已相遇，除非 resolvedFacts 明确说明本次发现。输出两段短叙事，每段不超过80字，用JSON数组返回。' },
          { role: 'user', content: JSON.stringify({ input: request.input, resolvedFacts: request.result, context: buildMemoryPacket(request.state) }) },
        ],
        response_format: { type: 'json_object' },
      })
    if (!response.ok) return null
    const payload = await response.json()
    const content = extractCompletionText(payload)
    if (!content) return null
    const parsed = parseJsonContent<{ narrative?: unknown }>(content)
    if (!parsed) return null
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

function mentionsHiddenWorldEntity(action: SuggestedAction, state: GameState) {
  const copy = `${action.title} ${action.description}`
  const hiddenNames = [
    ...state.npcs.filter((npc) => npc.met !== true).map((npc) => npc.name),
    ...state.locations.filter((location) => location.discovered === false).map((location) => location.name),
  ].filter((name) => name.trim().length > 1)
  return hiddenNames.some((name) => copy.includes(name))
}

export async function generateActionCandidates(config: ProviderConfig, request: ActionCandidatesRequest): Promise<SuggestedAction[] | null> {
  if (!config.apiKey.trim() || !config.endpoint.trim() || !config.model.trim()) return null
  try {
    const localCandidates = request.localCandidates.slice(0, 6)
    const ruleIds = new Set(localCandidates.map((action) => action.ruleId ?? action.id))
    const response = await postCompletion(config, {
        model: config.model,
        temperature: 0.85,
        messages: [
          { role: 'system', content: '你是 AI 人生模拟器的行动候选助手。只能基于给定 ruleId 生成候选文案，不得创造新规则、资源、人物、地点或成本逻辑。地图只能使用 context 中已知地点；不要把未探索地点写进行动标题或描述。只返回 JSON 对象：{"actions":[...]}。每次最多 6 个行动。' },
          { role: 'user', content: JSON.stringify({ script: request.script.manifest.title, context: buildMemoryPacket(request.state), allowedRuleIds: [...ruleIds].slice(0, 12), localCandidates }) },
        ],
        response_format: { type: 'json_object' },
      })
    if (!response.ok) return null
    const payload = await response.json()
    const content = extractCompletionText(payload)
    if (!content) return null
    const parsed = parseJsonContent<{ actions?: unknown }>(content)
    if (!parsed) return null
    if (!Array.isArray(parsed.actions)) return null
    const seen = new Set<string>()
    const candidates = parsed.actions.filter((item): item is SuggestedAction => {
      if (!validateSuggestedAction(item)) return false
      const action = item as SuggestedAction
      const ruleId = action.ruleId ?? action.id
      if (!ruleIds.has(ruleId) || seen.has(action.title) || mentionsHiddenWorldEntity(action, request.state)) return false
      seen.add(action.title)
      return true
    }).map((action, index) => {
      const ruleId = action.ruleId ?? action.id
      const localAction = localCandidates.find((candidate) => (candidate.ruleId ?? candidate.id) === ruleId)
      return localAction
        ? { ...localAction, title: action.title, description: action.description, id: `ai:${ruleId}:${request.state.turn}:${index}`, ruleId }
        : action
    })
    return candidates.length ? candidates.slice(0, 6) : null
  } catch {
    return null
  }
}

export interface IncidentRequest {
  state: GameState
  script: ScriptPackage
}

export async function generateIncident(config: ProviderConfig, request: IncidentRequest): Promise<IncidentCandidate | null> {
  if (!config.apiKey.trim() || !config.endpoint.trim() || !config.model.trim()) return null
  try {
    const response = await postCompletion(config, {
      model: config.model,
      temperature: 0.9,
      messages: [
        { role: 'system', content: '你是 AI 人生模拟器的突发事件候选助手。根据给定的有限上下文，偶尔提出一个小型、可延后的生活事件；也可以返回 null。绝对不能直接修改金钱、物品、健康、时间或事实。地图必须遵守发现规则：不能凭空创造地点；如事件确实带来新地点，只能从 discoverableLocationIds 中选择一个已有 locationId，并填入 revealsLocationId。discoverableLocationIds 只有白名单 ID，不代表玩家已经知道地点；不要猜测或写出未知地点名称、类型或位置。只能返回 JSON：{"incident":null} 或 {"incident":{"title":"","body":"","kind":"opportunity|complication|encounter|weather","tags":[],"dueInTurns":1,"npcId":"可选","relationshipDelta":0,"revealsLocationId":"可选地点ID"}}。标题不超过100字，正文不超过420字，最多4个标签，关系变化只能是-2到2。' },
        { role: 'user', content: JSON.stringify({ script: request.script.manifest.title, mapDiscovery: request.script.world.mapDiscovery, context: buildMemoryPacket(request.state), npcs: request.state.npcs.filter((npc) => npc.met === true).slice(0, 8).map((npc) => ({ id: npc.id, name: npc.name, role: npc.role, relationship: npc.relationship })), discoverableLocationIds: request.state.locations.filter((location) => location.discovered === false).slice(0, 12).map((location) => location.id) }) },
      ],
      response_format: { type: 'json_object' },
    })
    if (!response.ok) return null
    const payload = await response.json()
    const content = extractCompletionText(payload)
    if (!content) return null
    const parsed = parseJsonContent<{ incident?: unknown }>(content)
    if (!parsed) return null
    if (parsed.incident === null || parsed.incident === undefined) return null
    return validateIncidentCandidate(parsed.incident, request.state, request.script) ? parsed.incident : null
  } catch {
    return null
  }
}
