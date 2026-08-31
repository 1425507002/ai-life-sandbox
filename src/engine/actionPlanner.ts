import type { ActionGenerationMode, GameState, SuggestedAction } from '../types'

export const actionModeOptions: Array<{
  id: ActionGenerationMode
  title: string
  description: string
  detail: string
}> = [
  { id: 'guided', title: '选择优先', description: '只给出当前最合适的几个行动', detail: '适合想专注体验世界、少做输入的人' },
  { id: 'varied', title: '丰富建议', description: '完整展示行动，并随进度轮换顺序', detail: '适合希望每回合看到不同关注点的人' },
  { id: 'freeform', title: '自由行动', description: '保留建议，也可以自己输入行动', detail: '适合喜欢主动探索和尝试边界的人' },
]

export function getActionModeMeta(mode: ActionGenerationMode) {
  return actionModeOptions.find((option) => option.id === mode) ?? actionModeOptions[0]
}

function isAffordable(state: GameState, action: SuggestedAction) {
  return action.moneyCost <= state.player.money && action.staminaCost <= state.player.stamina
}

function guidedRank(state: GameState, action: SuggestedAction, index: number) {
  const currentPlace = state.world.location.split(' · ').at(-1) ?? state.world.location
  const nearby = action.location.includes(currentPlace) ? 2 : 0
  const affordable = isAffordable(state, action) ? 2 : 0
  const calm = action.risk === '低' || action.risk === '几乎没有' ? 1 : 0
  return nearby + affordable + calm - index / 100
}

export function getActionOptions(state: GameState, mode: ActionGenerationMode, rotation = 0): SuggestedAction[] {
  const source = state.suggestedActions
  if (mode === 'guided') return [...source].sort((a, b) => guidedRank(state, b, source.indexOf(b)) - guidedRank(state, a, source.indexOf(a))).slice(0, 3)
  if (mode === 'varied' && source.length > 1) {
    const offset = (Math.abs(state.turn) + Math.abs(rotation)) % source.length
    return [...source.slice(offset), ...source.slice(0, offset)]
  }
  return source
}
