import type { GameState, ProviderConfig } from '../types'

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
