import type { GameState, IncidentCandidate, ProviderConfig, ScriptPackage, SuggestedAction } from '../types'
import { validateSuggestedAction } from './scriptSchema'
import { buildMemoryPacket } from './memory'
import { validateIncidentCandidate } from './incidents'
import { classifyProviderFailure, describeResponseShape, extractCompletionText, formatProviderFailure, normalizeProviderErrorPayload, parseJsonContent, providerErrorDetails, type ProviderFailureInfo } from './providerContract'
import { applyScriptGenerationStage, buildScriptGenerationRequest, type ScriptGenerationPreferences, type ScriptGenerationReport, type ScriptGenerationStage } from './scriptGeneration'

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
// Keep the gameplay wait below five seconds while allowing real providers enough
// time to return a short JSON response on a cold request.
export const AI_ENHANCEMENT_TIMEOUT_MS = 4500

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

export interface ModelTimeoutResult<T> {
  value: T
  timedOut: boolean
}

export async function withModelTimeoutResult<T>(task: (signal: AbortSignal) => Promise<T>, fallback: T, timeoutMs = AI_ENHANCEMENT_TIMEOUT_MS): Promise<ModelTimeoutResult<T>> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<ModelTimeoutResult<T>>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve({ value: fallback, timedOut: true })
    }, timeoutMs)
  })
  const taskResult = task(controller.signal).then((value) => ({ value, timedOut: false }))
  try {
    return await Promise.race([taskResult, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function withModelTimeout<T>(task: (signal: AbortSignal) => Promise<T>, fallback: T, timeoutMs = AI_ENHANCEMENT_TIMEOUT_MS): Promise<T> {
  return (await withModelTimeoutResult(task, fallback, timeoutMs)).value
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
    const responseText = await response.text()
    let rawPayload: unknown = null
    try {
      rawPayload = JSON.parse(responseText)
    } catch {
      // A non-JSON 200 response is handled as a response-format failure below.
    }
    const payload = normalizeProviderErrorPayload(rawPayload, [config.apiKey])
    if (!response.ok) {
      const failure = classifyProviderFailure(response.status, payload)
      return { ok: false, message: formatProviderFailure(failure), failure }
    }
    const providerError = providerErrorDetails(payload)
    if (providerError.providerMessage || providerError.providerCode !== undefined) {
      const failure = classifyProviderFailure(response.status, payload)
      return { ok: false, message: formatProviderFailure(failure), failure }
    }
    if (!extractCompletionText(rawPayload)) {
      const responseHint = rawPayload === null && responseText.trim() ? '非 JSON 响应' : `返回字段：${describeResponseShape(rawPayload)}`
      return { ok: false, message: `服务已响应，但未找到可识别的模型文本（HTTP ${response.status}；${responseHint}）。`, failure: { kind: 'bad-response', httpStatus: response.status, retryable: false } }
    }
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

function normalizePlainNarrative(content: string): string[] | null {
  const paragraphs = content
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .split(/\n{2,}|(?<=[。！？])\s+(?=[^\s])/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((paragraph) => paragraph.slice(0, 180))
  return paragraphs.length ? paragraphs : null
}

export async function generateNarration(config: ProviderConfig, request: NarrationRequest, signal?: AbortSignal): Promise<string[] | null> {
  if (!config.apiKey.trim() || !config.endpoint.trim() || !config.model.trim()) return null
  try {
    const response = await postCompletion(config, {
      model: config.model,
      temperature: 0.7,
      max_tokens: 320,
        messages: [
          { role: 'system', content: '你是一个克制、连续、尊重游戏状态的中文人生模拟器叙事者。只润色已有事实，不新增资源、人物或结果。地图与人物也遵守已知边界：未在 context 中出现的地点和人物不能被写成玩家已知或已相遇，除非 resolvedFacts 明确说明本次发现。输出两段短叙事，每段不超过80字，用JSON数组返回。' },
          { role: 'user', content: JSON.stringify({ input: request.input, resolvedFacts: request.result, context: buildMemoryPacket(request.state) }) },
        ],
      }, signal)
    if (!response.ok) return null
    const payload = await response.json()
    const content = extractCompletionText(payload)
    if (!content) return null
    const parsed = parseJsonContent<{ narrative?: unknown }>(content)
    if (!parsed) return normalizePlainNarrative(content)
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

function normalizeActionTitle(title: string) {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export async function generateActionCandidates(config: ProviderConfig, request: ActionCandidatesRequest, signal?: AbortSignal): Promise<SuggestedAction[] | null> {
  if (!config.apiKey.trim() || !config.endpoint.trim() || !config.model.trim()) return null
  try {
    const localCandidates = request.localCandidates.slice(0, 6)
    const ruleIds = new Set(localCandidates.map((action) => action.ruleId ?? action.id))
    const response = await postCompletion(config, {
      model: config.model,
      temperature: 0.85,
      max_tokens: 640,
        messages: [
          { role: 'system', content: '你是 AI 人生模拟器的行动候选助手。只能基于给定 ruleId 生成候选文案，不得创造新规则、资源、人物、地点或成本逻辑。地图只能使用 context 中已知地点；不要把未探索地点写进行动标题或描述。只返回 JSON 对象：{"actions":[...]}。每次最多 6 个行动。' },
          { role: 'user', content: JSON.stringify({ script: request.script.manifest.title, context: buildMemoryPacket(request.state), allowedRuleIds: [...ruleIds].slice(0, 12), localCandidates }) },
        ],
      }, signal)
    if (!response.ok) return null
    const payload = await response.json()
    const content = extractCompletionText(payload)
    if (!content) return null
    const parsed = parseJsonContent<{ actions?: unknown }>(content)
    if (!parsed) return null
    if (!Array.isArray(parsed.actions)) return null
    const seenTitles = new Set<string>()
    const seenRuleIds = new Set<string>()
    const recentTitles = new Set(request.state.history.slice(0, 12).map((event) => normalizeActionTitle(event.title)).filter(Boolean))
    const candidates = parsed.actions.filter((item): item is SuggestedAction => {
      if (!validateSuggestedAction(item)) return false
      const action = item as SuggestedAction
      const ruleId = action.ruleId ?? action.id
      const title = normalizeActionTitle(action.title)
      if (!ruleIds.has(ruleId) || seenRuleIds.has(ruleId) || !title || seenTitles.has(title) || recentTitles.has(title) || mentionsHiddenWorldEntity(action, request.state)) return false
      seenRuleIds.add(ruleId)
      seenTitles.add(title)
      return true
    }).map((action, index) => {
      const ruleId = action.ruleId ?? action.id
      const localAction = localCandidates.find((candidate) => (candidate.ruleId ?? candidate.id) === ruleId)
      return localAction
        ? { ...localAction, title: action.title, description: action.description, id: `ai:${ruleId}:${request.state.turn}:${index}`, ruleId }
        : action
    })
    const merged = [...candidates]
    localCandidates.forEach((localAction) => {
      if (merged.length >= 6) return
      const ruleId = localAction.ruleId ?? localAction.id
      const title = normalizeActionTitle(localAction.title)
      if (seenRuleIds.has(ruleId) || !title || seenTitles.has(title) || recentTitles.has(title)) return
      seenRuleIds.add(ruleId)
      seenTitles.add(title)
      merged.push(localAction)
    })
    return merged.length ? merged.slice(0, 6) : null
  } catch {
    return null
  }
}

export interface IncidentRequest {
  state: GameState
  script: ScriptPackage
}

function scriptGenerationFailure(stage: ScriptGenerationStage, error: string): ScriptGenerationReport {
  return { valid: false, stage, errors: [error], warnings: [], changedKeys: [] }
}

export async function generateScriptStageDraft(config: ProviderConfig, script: ScriptPackage, stage: ScriptGenerationStage, preferences: ScriptGenerationPreferences = {}, signal?: AbortSignal): Promise<ScriptGenerationReport> {
  if (!config.apiKey.trim() || !config.endpoint.trim() || !config.model.trim()) return scriptGenerationFailure(stage, 'AI_CONFIG: 请先填写 Endpoint、Model 和 API Key。')
  const request = buildScriptGenerationRequest(script, stage, preferences)
  try {
    const response = await postCompletion(config, {
      model: config.model,
      temperature: 0.35,
      max_tokens: request.maxOutputTokens,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: JSON.stringify(request.userPayload) },
      ],
      response_format: request.responseFormat,
    }, signal)
    const responseText = await response.text()
    let rawPayload: unknown = null
    try { rawPayload = JSON.parse(responseText) } catch { /* format error below */ }
    const normalized = normalizeProviderErrorPayload(rawPayload, [config.apiKey])
    if (!response.ok) {
      const failure = classifyProviderFailure(response.status, normalized)
      return scriptGenerationFailure(stage, `AI_PROVIDER: ${formatProviderFailure(failure)}`)
    }
    const content = extractCompletionText(rawPayload)
    if (!content) return scriptGenerationFailure(stage, `AI_RESPONSE_FORMAT: 未找到可识别的模型文本（HTTP ${response.status}；返回字段：${describeResponseShape(rawPayload)}）。`)
    const parsed = parseJsonContent<unknown>(content)
    if (!parsed) return scriptGenerationFailure(stage, 'AI_RESPONSE_FORMAT: 模型文本不是可解析的 JSON 对象。')
    return applyScriptGenerationStage(script, stage, parsed)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return scriptGenerationFailure(stage, 'AI_TIMEOUT: 剧本阶段生成已超时，当前世界未被修改。')
    return scriptGenerationFailure(stage, 'AI_NETWORK: 剧本阶段生成请求未完成，当前世界未被修改。')
  }
}

export async function generateIncident(config: ProviderConfig, request: IncidentRequest, signal?: AbortSignal): Promise<IncidentCandidate | null> {
  if (!config.apiKey.trim() || !config.endpoint.trim() || !config.model.trim()) return null
  try {
    const response = await postCompletion(config, {
      model: config.model,
      temperature: 0.9,
      max_tokens: 480,
      messages: [
        { role: 'system', content: '你是 AI 人生模拟器的突发事件候选助手。根据给定的有限上下文，偶尔提出一个小型、可延后的生活事件；也可以返回 null。绝对不能直接修改金钱、物品、健康、时间或事实。地图必须遵守发现规则：不能凭空创造地点；如事件确实带来新地点，只能从 discoverableLocationIds 中选择一个已有 locationId，并填入 revealsLocationId。discoverableLocationIds 只有白名单 ID，不代表玩家已经知道地点；不要猜测或写出未知地点名称、类型或位置。只能返回 JSON：{"incident":null} 或 {"incident":{"title":"","body":"","kind":"opportunity|complication|encounter|weather","tags":[],"dueInTurns":1,"npcId":"可选","relationshipDelta":0,"revealsLocationId":"可选地点ID"}}。标题不超过100字，正文不超过420字，最多4个标签，关系变化只能是-2到2。' },
        { role: 'user', content: JSON.stringify({ script: request.script.manifest.title, mapDiscovery: request.script.world.mapDiscovery, context: buildMemoryPacket(request.state), npcs: request.state.npcs.filter((npc) => npc.met === true).slice(0, 8).map((npc) => ({ id: npc.id, name: npc.name, role: npc.role, relationship: npc.relationship })), discoverableLocationIds: request.state.locations.filter((location) => location.discovered === false).slice(0, 12).map((location) => location.id) }) },
      ],
    }, signal)
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
