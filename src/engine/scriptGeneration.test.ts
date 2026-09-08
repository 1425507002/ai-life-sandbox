import { describe, expect, it } from 'vitest'
import { getScript } from '../data/scripts'
import { applyScriptGenerationStage, buildScriptGenerationRequest, getScriptGenerationStageLabel } from './scriptGeneration'

describe('staged script generation protocol', () => {
  const script = getScript('western-world')

  it('builds a bounded request with only the selected stage contract', () => {
    const request = buildScriptGenerationRequest(script, 'maps', { mapId: 'mist-town', ageStage: 'adult' })

    expect(request.stage).toBe('maps')
    expect(request.maxOutputTokens).toBeGreaterThan(0)
    expect(request.responseFormat).toEqual({ type: 'json_object' })
    expect(request.systemPrompt).toContain('地图与地点')
    expect(request.systemPrompt).toContain('不得改变题材')
    expect(request.userPayload.allowedKeys).toEqual(['maps'])
    expect(request.userPayload.allowedMapIds).toEqual(['mist-town', 'tide-harbor'])
  })

  it('accepts a valid stage overlay without changing the script identity', () => {
    const result = applyScriptGenerationStage(script, 'world', {
      opening: ['新的清晨从熟悉的屋檐开始。'],
      ageStageOpenings: { baby: ['先接受照料。'] },
      publicNews: ['社区公告栏贴上了新消息。'],
      currentFocus: '决定今天先照顾自己还是观察街区',
      atmosphere: '安静 · 有微风',
    })

    expect(result.valid).toBe(true)
    expect(result.changedKeys).toEqual(['opening', 'ageStageOpenings', 'publicNews', 'currentFocus', 'atmosphere'])
    expect(result.script?.manifest.id).toBe(script.manifest.id)
    expect(result.script?.world.opening).toEqual(['新的清晨从熟悉的屋檐开始。'])
    expect(result.script?.world.seedState.world.currentFocus).toContain('今天')
  })

  it('rejects attempts to write runtime state or unknown stage fields', () => {
    const result = applyScriptGenerationStage(script, 'events', {
      events: script.events,
      history: [],
      sessions: {},
    })

    expect(result.valid).toBe(false)
    expect(result.script).toBeUndefined()
    expect(result.errors.some((error) => error.includes('AI_STATE_WRITE'))).toBe(true)
  })

  it('rejects dangling rule references after a staged action update', () => {
    const result = applyScriptGenerationStage(script, 'actions', {
      ageStageActions: { adult: [{ ...script.ageStageActions?.adult?.[0], ruleId: 'missing-rule' }] },
      rules: script.rules,
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('AI_REFERENCE'))).toBe(true)
  })

  it('labels every generation stage for the future preview UI', () => {
    expect(getScriptGenerationStageLabel('world')).toBe('世界骨架')
    expect(getScriptGenerationStageLabel('maps')).toBe('地图与地点')
    expect(getScriptGenerationStageLabel('characters')).toBe('人物与身份')
    expect(getScriptGenerationStageLabel('actions')).toBe('行动与规则')
    expect(getScriptGenerationStageLabel('events')).toBe('事件与开场内容')
  })
})
