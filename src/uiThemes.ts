import type { UiThemeId } from './types'

export interface UiTheme {
  id: UiThemeId
  title: string
  description: string
  displayFont: string
  radius: string
  buttonRadius: string
  shadow: string
  navBackground: string
  cardBackground: string
  border: string
  density: string
}

export const uiThemes: UiTheme[] = [
  {
    id: 'paper-journal', title: '纸页手账', description: '温和、生活化，保留当前的纸张与手账气质。',
    displayFont: '"Noto Serif SC", serif', radius: '15px', buttonRadius: '10px',
    shadow: '0 12px 30px rgba(45,78,57,.08)', navBackground: 'rgba(255,250,242,.92)', cardBackground: 'rgba(255,252,247,.72)', border: 'rgba(45,78,57,.16)', density: '1',
  },
  {
    id: 'twilight-library', title: '暮色书库', description: '更沉静、更像一本正在翻阅的世界设定集。',
    displayFont: '"Noto Serif SC", Georgia, serif', radius: '8px', buttonRadius: '7px',
    shadow: '0 14px 34px rgba(51,39,67,.12)', navBackground: 'rgba(248,244,250,.94)', cardBackground: 'rgba(255,251,255,.78)', border: 'rgba(86,68,105,.2)', density: '.96',
  },
  {
    id: 'field-notes', title: '远行札记', description: '边框更轻、信息更紧凑，适合频繁查看状态与行动。',
    displayFont: 'Inter, "Noto Sans SC", sans-serif', radius: '11px', buttonRadius: '8px',
    shadow: '0 8px 22px rgba(49,78,73,.08)', navBackground: 'rgba(242,249,246,.94)', cardBackground: 'rgba(250,255,252,.78)', border: 'rgba(45,91,79,.18)', density: '.9',
  },
  {
    id: 'harbor-postcard', title: '港口明信片', description: '更明亮、更有旅行感，适合探索地图与人物关系。',
    displayFont: '"Noto Serif SC", serif', radius: '20px', buttonRadius: '999px',
    shadow: '0 16px 38px rgba(65,87,104,.12)', navBackground: 'rgba(247,251,252,.94)', cardBackground: 'rgba(255,255,255,.78)', border: 'rgba(58,102,121,.18)', density: '1.04',
  },
]

export function getUiTheme(id: UiThemeId) {
  return uiThemes.find((theme) => theme.id === id) ?? uiThemes[0]
}

export function isUiThemeId(input: unknown): input is UiThemeId {
  return uiThemes.some((theme) => theme.id === input)
}
