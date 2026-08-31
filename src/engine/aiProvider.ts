import type { GameState, ProviderConfig, ScriptPackage, SuggestedAction } from '../types'
import { validateSuggestedAction } from './scriptSchema'

export interface NarrationRequest {
  input: string
  result: string[]
  state: GameState
}

export async function generateNarration(config: ProviderConfig, request: NarrationRequest): Promise<string[] | null> {
  if (!config.apiKey.trim() || !config.endpoint.trim() || !config.model.trim()) return null
  try {
    const response = await fetch(config.endpoint.replace(/\/$/, ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: '你是一个克制、连续、尊重游戏状态的中文人生模拟器叙事者。只润色已有事实，不新增资源、人物或结果。输出两段短叙事，每段不超过80字，用JSON数组返回。' },
          { role: 'user', content: JSON.stringify({ input: request.input, resolvedFacts: request.result, location: request.state.world.location, time: request.state.world.time, player: request.state.player }) },
        ],
        response_format: { type: 'json_object' },
      }),
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
    const response = await fetch(config.endpoint.replace(/\/$/, ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.85,
        messages: [
          { role: 'system', content: '你是 AI 人生模拟器的行动候选助手。只能基于给定 ruleId 生成候选文案，不得创造新规则、资源、人物、地点或成本逻辑。只返回 JSON 对象：{"actions":[...]}。每次最多 6 个行动。' },
          { role: 'user', content: JSON.stringify({ script: request.script.manifest.title, state: request.state, allowedRuleIds: [...ruleIds], localCandidates: request.localCandidates }) },
        ],
        response_format: { type: 'json_object' },
      }),
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
