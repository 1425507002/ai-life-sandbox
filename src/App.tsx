import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import {
  Anchor, ArrowUpRight, BookOpen, BriefcaseBusiness, Check, ChevronRight, CircleAlert, CircleHelp,
  Clock3, Compass, Database, Download, Hammer, HeartHandshake, History, Home, Leaf, Map,
  ListChecks, Menu, Moon, PanelRight, PenLine, RotateCcw, ScrollText, Search, Send, Settings, ShieldCheck, Sparkles,
  Sun, Shuffle, Upload, UserRound, UsersRound, WalletCards, Wind, X, Zap,
} from 'lucide-react'
import { actionModeOptions, getActionModeMeta, getActionOptions } from './engine/actionPlanner'
import { checkProviderConnection } from './engine/aiProvider'
import { getAgeOptions, getAgeStageDefinitions, getAgeStageForAge } from './engine/ageRules'
import { downloadSave } from './storage'
import { useGameStore } from './store'
import type { ActionGenerationMode, ActionOutcome, ActionSummary, GameState, NavKey, ProviderConfig, ScriptPackage, SuggestedAction, UiThemeId } from './types'
import { getUiTheme, uiThemes } from './uiThemes'

const navItems: Array<{ id: NavKey; label: string; icon: typeof BookOpen }> = [
  { id: 'play', label: '当前场景', icon: BookOpen },
  { id: 'character', label: '角色', icon: UserRound },
  { id: 'people', label: '人物', icon: UsersRound },
  { id: 'history', label: '履历', icon: History },
  { id: 'map', label: '地图', icon: Map },
  { id: 'settings', label: '设置', icon: Settings },
]

const iconForLocation = (kind: string) => kind === '生活' ? Home : kind === '工作' ? BriefcaseBusiness : kind === '探索' ? Compass : Anchor
const money = (value: number) => `${value} 枚铜币`
const outcomeLabel: Record<ActionOutcome, string> = { success: '行动完成', partial: '部分完成', refused: '行动未执行', failed: '行动失败', unknown: '仍待确认' }
const providerPresets: Array<{ id: string; label: string; endpoint: string; model: string; note: string }> = [
  { id: 'zhipu-flash', label: '智谱 · GLM-4.7-Flash（推荐）', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4.7-flash', note: '免费模型，适合首次接入和中文角色叙事测试。' },
  { id: 'qwen-flash', label: '通义千问 · Qwen-Flash', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-flash', note: '低成本模型，适合日常叙事与行动候选测试。' },
  { id: 'deepseek-flash', label: 'DeepSeek · V4-Flash', endpoint: 'https://api.deepseek.com/chat/completions', model: 'deepseek-v4-flash', note: '低成本模型，适合后续质量与成本对照。' },
  { id: 'custom', label: '自定义 OpenAI-compatible 服务', endpoint: '', model: '', note: '填写任意兼容 Chat Completions 的服务地址。' },
]

function providerPresetId(config: ProviderConfig) {
  return providerPresets.find((preset) => preset.endpoint === config.endpoint && preset.model === config.model)?.id ?? 'custom'
}

function App() {
  const { scripts, sessions, activeScriptId, activeLifeId, activeNav, providerConfig, actionMode, uiThemeId, hydrated, lastAction, lastNotice, selectScript, selectLife, setNav, setActionMode, setUiTheme, runAction, setProviderConfig, hydrate, startNewLife, updatePlayer, rollbackLife, notify, clearNotice, importRuntime, importScriptPackage, getExportPayload } = useGameStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [actionInput, setActionInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [characterEditOpen, setCharacterEditOpen] = useState(false)
  const [newLifeOpen, setNewLifeOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const scriptInput = useRef<HTMLInputElement>(null)
  const script = scripts.find((item) => item.manifest.id === activeScriptId) ?? scripts[0]
  const state = sessions[activeLifeId]?.state ?? script.world.seedState
  const uiTheme = getUiTheme(uiThemeId)

  useEffect(() => { void hydrate() }, [hydrate])
  useEffect(() => {
    if (!lastNotice) return
    const timer = window.setTimeout(clearNotice, 5200)
    return () => window.clearTimeout(timer)
  }, [lastNotice, clearNotice])

  const handleAction = async (input = actionInput) => {
    if (!input.trim() || busy) return
    setBusy(true)
    await runAction(input)
    setActionInput('')
    setBusy(false)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void handleAction()
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      importRuntime(JSON.parse(await file.text()))
      setNav('play')
    } catch { notify({ type: 'error', message: '存档读取失败，请确认这是有效的 AI Life Worlds 存档。' }) }
    event.target.value = ''
  }

  const handleScriptImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = importScriptPackage(JSON.parse(await file.text()))
      if (!imported) window.alert('这个文件不是有效的 .aiworld.json 剧本包。')
    } catch {
      window.alert('剧本包读取失败，请检查 JSON 格式。')
    }
    event.target.value = ''
  }

  if (!hydrated) return <div className="loading-screen"><Sparkles size={20} /><span>正在唤醒这个世界…</span></div>

  const rootStyle = {
    '--accent': script.theme.accent,
    '--accent-soft': script.theme.accentSoft,
    '--accent-warm': script.theme.accentWarm,
    '--ink': script.theme.ink,
    '--paper': script.theme.paper,
    '--surface': script.theme.surface,
    '--sky': script.theme.sky,
    '--ui-font-display': uiTheme.displayFont,
    '--ui-radius': uiTheme.radius,
    '--ui-button-radius': uiTheme.buttonRadius,
    '--ui-shadow': uiTheme.shadow,
    '--ui-nav-background': uiTheme.navBackground,
    '--ui-card-background': uiTheme.cardBackground,
    '--ui-border': uiTheme.border,
    '--ui-density': uiTheme.density,
  } as CSSProperties

  return (
    <div className="app-shell" style={rootStyle}>
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark"><Leaf size={18} /></div>
          <div><span className="brand-name">AI LIFE</span><span className="brand-sub">WORLDS</span></div>
          <button className="icon-button sidebar-close" aria-label="关闭导航" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="brand-rule" />
        <nav className="primary-nav" aria-label="主导航">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${activeNav === id ? 'active' : ''}`} onClick={() => { setNav(id); setMobileOpen(false) }}><Icon size={18} /><span>{label}</span>{id === 'play' && <span className="nav-dot" />}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="script-mini-label"><span>正在生活于</span><span className="script-version">v{script.manifest.version}</span></div>
          <div className="script-mini-card">
            <div className="script-mini-icon"><Compass size={17} /></div>
            <div><strong>{script.manifest.title.split('：')[0]}</strong><span>{script.manifest.subtitle}</span></div>
          </div>
          <label className="select-label" htmlFor="script-switcher">切换剧本世界</label>
          <select id="script-switcher" value={activeScriptId} onChange={(event) => selectScript(event.target.value)}>
            {scripts.map((item) => <option key={item.manifest.id} value={item.manifest.id}>{item.manifest.title}</option>)}
          </select>
          <label className="select-label life-select-label" htmlFor="life-switcher">继续人生存档</label>
          <select id="life-switcher" value={activeLifeId} onChange={(event) => selectLife(event.target.value)}>
            {Object.values(sessions).filter((session) => session.scriptId === activeScriptId).map((session) => <option key={session.lifeId} value={session.lifeId}>{session.label ?? '未命名人生'} · 第 {session.state.world.day} 日</option>)}
          </select>
          <button className="wide-button sidebar-new-life" type="button" onClick={() => setNewLifeOpen(true)}><Sparkles size={15} /> 开始一段新人生</button>
          <div className="local-note"><Database size={14} /><span>本地存档已启用</span></div>
        </div>
      </aside>

      {mobileOpen && <button className="scrim" aria-label="关闭导航" onClick={() => setMobileOpen(false)} />}

      <main className="main-area">
        <header className="mobile-header">
          <button className="icon-button" aria-label="打开导航" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="mobile-title"><span>{script.manifest.title.split('：')[0]}</span><small>第 {state.world.day} 日 · {state.world.time.split(' · ')[0]}</small></div>
          {activeNav === 'character' ? <button className="icon-button" aria-label="编辑角色档案" onClick={() => setCharacterEditOpen(true)}><PenLine size={18} /></button> : <div className="mobile-weather"><WeatherIcon weather={state.world.weather} /><span>{state.world.weather}</span></div>}
        </header>
        <div className="desktop-topline">
          <div className="breadcrumb"><span>人生世界</span><ChevronRight size={14} /><strong>{script.manifest.title}</strong></div>
          <div className="topline-actions"><span className="save-status"><Check size={14} /> 已保存到本地</span>{activeNav === 'character' && <button className="quiet-button compact" onClick={() => setCharacterEditOpen(true)}><PenLine size={14} /> 编辑档案</button>}<button className="icon-button" aria-label="设置" onClick={() => setNav('settings')}><Settings size={18} /></button></div>
        </div>
        {lastNotice && <div className={`toast-notice ${lastNotice.type}`} role="status" aria-live="polite"><span>{lastNotice.message}</span><button type="button" aria-label="关闭提示" onClick={clearNotice}><X size={14} /></button></div>}
        {activeNav === 'play' && <PlayScreen state={state} script={script} actionMode={actionMode} busy={busy} lastAction={lastAction} input={actionInput} setInput={setActionInput} onSubmit={handleSubmit} onAction={(input) => void handleAction(input)} />}
        {activeNav === 'character' && <CharacterScreen state={state} script={script} onReset={() => setNewLifeOpen(true)} />}
        {activeNav === 'people' && <PeopleScreen state={state} />}
        {activeNav === 'history' && <HistoryScreen state={state} onRollback={rollbackLife} />}
        {activeNav === 'map' && <MapScreen state={state} />}
        {activeNav === 'settings' && <SettingsScreen script={script} actionMode={actionMode} onActionModeChange={setActionMode} uiThemeId={uiThemeId} onUiThemeChange={setUiTheme} providerConfig={providerConfig} onProviderChange={setProviderConfig} onExport={() => downloadSave(getExportPayload())} onImport={() => fileInput.current?.click()} onImportScript={() => scriptInput.current?.click()} onReset={() => setNewLifeOpen(true)} />}
        <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void handleImport(event)} />
        <input ref={scriptInput} className="visually-hidden" type="file" accept="application/json,.json,.aiworld.json" onChange={(event) => void handleScriptImport(event)} />
      </main>

      {characterEditOpen && <CharacterEditor state={state} script={script} onClose={() => setCharacterEditOpen(false)} onSave={(patch) => { updatePlayer(patch); setCharacterEditOpen(false) }} />}
      {newLifeOpen && <NewLifeModal state={state} script={script} onClose={() => setNewLifeOpen(false)} onStart={(setup) => { startNewLife(setup); setNewLifeOpen(false) }} />}

      <nav className="bottom-nav" aria-label="移动端主导航">
        {navItems.slice(0, 5).map(({ id, label, icon: Icon }) => <button key={id} className={activeNav === id ? 'active' : ''} onClick={() => setNav(id)}><Icon size={18} /><span>{label === '当前场景' ? '场景' : label}</span></button>)}
      </nav>
    </div>
  )
}

function WeatherIcon({ weather }: { weather: string }) {
  if (weather.includes('雾')) return <Wind size={16} />
  if (weather.includes('海')) return <Anchor size={16} />
  if (weather.includes('雨')) return <CloudRainIcon />
  return <Sun size={16} />
}

function CloudRainIcon() { return <Wind size={16} /> }

function PlayScreen({ state, script, actionMode, busy, lastAction, input, setInput, onSubmit, onAction }: { state: GameState; script: ScriptPackage; actionMode: ActionGenerationMode; busy: boolean; lastAction: ActionSummary | null; input: string; setInput: (value: string) => void; onSubmit: (event: FormEvent) => void; onAction: (input: string) => void }) {
  const [suggestionRotation, setSuggestionRotation] = useState(0)
  const actionOptions = useMemo(() => getActionOptions(state, actionMode, suggestionRotation), [state, actionMode, suggestionRotation])
  const modeMeta = getActionModeMeta(actionMode)
  const showComposer = actionMode === 'freeform'
  return <div className={`page page-play ${actionMode}`}>
    <section className="page-heading">
      <div><p className="eyebrow"><span className="eyebrow-line" />正在发生</p><h1>{state.world.location.split(' · ')[0]}</h1><p className="heading-copy">{script.manifest.description}</p></div>
      <div className="date-card"><WeatherIcon weather={state.world.weather} /><div><strong>第 {state.world.day} 日</strong><span>{state.world.time}</span></div><div className="date-divider" /><div><strong>{state.world.season}</strong><span>{state.world.weather}</span></div></div>
    </section>
    <div className="play-grid">
      <section className="story-column">
        <div className="scene-card">
          <div className="scene-card-top"><span className="section-kicker"><BookOpen size={15} /> 当前场景</span><span className="scene-location"><Compass size={14} /> {state.world.location}</span></div>
          <div className="scene-art"><div className="sun-disc" /><div className="hill hill-back" /><div className="hill hill-front" /><div className="cabin"><div className="cabin-roof" /><div className="cabin-body"><span /><span /></div></div><div className="scene-reed reed-one" /><div className="scene-reed reed-two" /></div>
          <div className="story-copy">{state.world.narrative.map((paragraph, index) => <p key={`${paragraph}-${index}`} className={index === 0 ? 'lead' : ''}>{paragraph}</p>)}</div>
          <div className="atmosphere"><Wind size={15} /><span>环境气息</span><strong>{state.world.atmosphere}</strong></div>
        </div>
        <div className="focus-strip" aria-live="polite"><Compass size={16} /><div><span>眼下的线索</span><strong>{state.world.currentFocus}</strong></div></div>
        {lastAction && <ActionFeedback action={lastAction} />}
        <section className={`action-section ${actionMode}`}><div className="section-title-row"><div><p className="eyebrow"><span className="eyebrow-line" />行动入口</p><h2>{actionMode === 'guided' ? '现在可以做什么' : '今天可以做什么'}</h2></div><div className="action-title-tools"><span className="action-mode-badge"><ListChecks size={13} /> {modeMeta.title}</span>{actionMode === 'varied' && <button type="button" className="action-refresh" onClick={() => setSuggestionRotation((rotation) => rotation + 1)}><Shuffle size={13} /> 换个顺序</button>}</div></div><p className="action-mode-description">{modeMeta.description}</p><div className="action-cards">{actionOptions.map((action) => <ActionCard key={action.id} action={action} state={state} busy={busy} selected={lastAction?.title === action.title} onClick={onAction} />)}</div></section>
        {showComposer && <form className="action-composer" aria-label="自由行动输入" onSubmit={onSubmit}><PenLine size={18} /><input aria-label="输入你的行动" value={input} onChange={(event) => setInput(event.target.value)} placeholder={busy ? '世界正在回应…' : '输入你的行动…'} disabled={busy} /><span className="composer-hint">Enter</span><button type="submit" disabled={busy || !input.trim()} aria-label="提交行动">{busy ? <RotateCcw className="spin" size={18} /> : <Send size={18} />}</button></form>}
        <div className="small-rule-note"><CircleHelp size={14} /><span>{showComposer ? '行动卡是快捷入口，也可以在输入框里尝试自己的行动。' : '选择一个行动即可继续人生；想开放尝试时，可在设置里开启自由行动。'}</span></div>
      </section>
      <aside className="right-rail"><StatusCard state={state} /><WorldCard state={state} /><NewsCard state={state} /><UpcomingEvents state={state} /></aside>
    </div>
  </div>
}

function ActionFeedback({ action }: { action: ActionSummary }) {
  const isRefused = action.outcome === 'refused' || action.outcome === 'failed'
  const Icon = isRefused ? CircleAlert : action.outcome === 'unknown' ? CircleHelp : Check
  return <div className={`action-feedback ${action.outcome}`} role="status" aria-live="polite"><div className="feedback-icon"><Icon size={17} /></div><div className="feedback-copy"><div className="feedback-heading"><strong>{action.title}</strong><span>{outcomeLabel[action.outcome]}</span></div><p>{action.feedback}</p><div className="feedback-deltas">{action.deltas.map((delta, index) => <span key={`${delta}-${index}`}>{delta}</span>)}<span>{action.timeLabel}</span></div>{action.stateDiff?.length ? <div className="state-diff" aria-label="状态变化">{action.stateDiff.slice(0, 4).map((diff) => <span key={diff.key}>{diff.label} {diff.before} → {diff.after}</span>)}</div> : null}</div><span className="feedback-label">刚刚</span></div>
}

function ActionCard({ action, state, busy, selected, onClick }: { action: SuggestedAction; state: GameState; busy: boolean; selected: boolean; onClick: (input: string) => void }) {
  const ruleId = action.ruleId ?? action.id
  const Icon = ruleId === 'smith' || ruleId === 'rhea' ? Hammer : ruleId === 'forest' || ruleId === 'lighthouse' ? Leaf : ruleId === 'dock' ? Anchor : ruleId === 'tidy' ? Home : Compass
  const hasMoney = action.moneyCost <= state.player.money
  const hasStamina = action.staminaCost <= state.player.stamina
  const availability = !hasMoney ? `需要 ${action.moneyCost} 枚铜币` : !hasStamina ? `需要精力 ${action.staminaCost}` : '当前可执行'
  return <button type="button" className={`action-card ${action.tone} ${selected ? 'selected' : ''} ${hasMoney && hasStamina ? '' : 'unavailable'}`} onClick={() => onClick(action.title)} disabled={busy} aria-pressed={selected} aria-label={`${action.title}。${action.description}。消耗 ${action.timeCost} 分钟和 ${action.staminaCost} 点精力${action.moneyCost ? `，花费 ${action.moneyCost} 枚铜币` : ''}。风险 ${action.risk}。${availability}`}><div className="action-card-icon"><Icon size={19} /></div><div className="action-card-content"><div className="action-card-title"><strong>{action.title}</strong><span className="action-card-destination">{action.location}</span></div><span>{action.description}</span><small><Clock3 size={12} /> {action.timeCost} 分钟 <i /> <Zap size={12} /> -{action.staminaCost} 精力 {action.moneyCost ? <><i /> <WalletCards size={12} /> -{action.moneyCost} 铜币</> : null} <i /> <ShieldCheck size={12} /> 风险 {action.risk}</small><em className="action-card-availability">{availability}</em></div><ChevronRight className="action-chevron" size={18} /></button>
}

function StatusCard({ state }: { state: GameState }) {
  return <section className="rail-card status-card"><div className="rail-card-header"><span className="section-kicker"><UserRound size={15} /> 你</span><span className="status-live">在线</span></div><div className="avatar-row"><div className="avatar avatar-large">{state.player.name.slice(0, 1)}</div><div><strong>{state.player.name}</strong><span>{state.player.role} · {state.player.age} 岁</span></div><ArrowUpRight size={16} /></div><div className="role-line"><BriefcaseBusiness size={14} /><span>{state.player.profession}</span><span className="role-separator" /> <HeartHandshake size={14} /><span>{state.player.mood}</span></div><StatBar icon={<Zap size={14} />} label="体力" value={state.player.stamina} tone="green" /><StatBar icon={<ShieldCheck size={14} />} label="状态" value={state.player.health} tone="coral" /><div className="money-line"><WalletCards size={15} /><span>随身钱币</span><strong>{money(state.player.money)}</strong></div></section>
}

function StatBar({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) { return <div className="stat-line"><div className="stat-label">{icon}<span>{label}</span></div><div className="stat-track"><span className={tone} style={{ width: `${value}%` }} /></div><strong>{value}</strong></div> }

function WorldCard({ state }: { state: GameState }) { return <section className="rail-card world-card"><div className="rail-card-header"><span className="section-kicker"><Compass size={15} /> 世界状态</span><span className="small-link">查看全部</span></div><div className="world-list"><div><Sun size={15} /><span>季节</span><strong>{state.world.season}</strong></div><div><WeatherIcon weather={state.world.weather} /><span>天气</span><strong>{state.world.weather}</strong></div><div><Clock3 size={15} /><span>时间</span><strong>{state.world.time}</strong></div></div><div className="headline"><Sparkles size={14} /><span>{state.world.headline}</span></div></section> }

function NewsCard({ state }: { state: GameState }) { return <section className="rail-card news-card"><div className="rail-card-header"><span className="section-kicker"><ScrollText size={15} /> 镇上正在说</span><span className="news-count">{state.world.publicNews.length}</span></div><ul>{state.world.publicNews.map((news, index) => <li key={`${news}-${index}`}><span className="news-bullet" />{news}</li>)}</ul></section> }

function UpcomingEvents({ state }: { state: GameState }) {
  const events = [...(state.scheduledEvents ?? [])].sort((a, b) => a.dueTurn - b.dueTurn)
  if (!events.length) return null
  return <section className="rail-card event-card"><div className="rail-card-header"><span className="section-kicker"><Clock3 size={15} /> 正在酝酿</span><span className="news-count">{events.length}</span></div><ul>{events.slice(0, 3).map((event) => <li key={event.id}><span className="event-turn">第 {Math.max(1, event.dueTurn - state.turn)} 轮</span><span>{event.title}</span></li>)}</ul></section>
}

function CharacterScreen({ state, script, onReset }: { state: GameState; script: ScriptPackage; onReset: () => void }) { return <div className="page"><PageHeader eyebrow="角色档案" title={state.player.name} copy={`${script.manifest.title} · 第 ${state.world.day} 日`} action={<button className="quiet-button" onClick={onReset}><RotateCcw size={15} /> 重新开始人生</button>} /><div className="character-layout"><section className="profile-hero"><div className="profile-avatar">{state.player.name.slice(0, 1)}</div><div><p className="eyebrow">当前身份</p><h2>{state.player.role}</h2><p>{state.player.profession} · {state.player.age} 岁</p></div><div className="profile-location"><Compass size={15} /><span>{state.world.location}</span></div></section><section className="info-grid"><InfoBlock label="身体状态" value={`${state.player.health}/100`} icon={<ShieldCheck size={17} />} tone="coral" /><InfoBlock label="行动精力" value={`${state.player.stamina}/100`} icon={<Zap size={17} />} tone="green" /><InfoBlock label="随身钱币" value={money(state.player.money)} icon={<WalletCards size={17} />} tone="gold" /><InfoBlock label="镇上声望" value={`${state.player.reputation} 点`} icon={<HeartHandshake size={17} />} tone="sky" /></section><section className="detail-panel"><div className="panel-title"><span>关于你</span><span className="panel-meta">第 {state.turn} 次记录</span></div><div className="trait-list">{state.player.traits.map((trait, index) => <span key={`${trait}-${index}`}>{trait}</span>)}</div><p className="detail-copy">你没有默认的主线，也没有必须完成的命运。今天做什么、与谁相遇、最终成为怎样的人，都将从一次次具体选择里慢慢长出来。</p></section><section className="detail-panel"><div className="panel-title"><span>随身物品</span><span className="panel-meta">{state.inventory.length} 件</span></div><div className="inventory-list">{state.inventory.map((item, index) => <div key={`${item}-${index}`}><span className="item-dot" /><strong>{item}</strong><span>可用</span></div>)}</div></section></div></div> }

function InfoBlock({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) { return <div className={`info-block ${tone}`}><div className="info-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div> }

function PeopleScreen({ state }: { state: GameState }) { return <div className="page"><PageHeader eyebrow="人物关系" title="他们也在过自己的生活" copy="你知道的只是他们愿意让你知道的部分。关系会随着实际经历改变。" /><div className="people-grid">{state.npcs.map((npc) => <article className="person-card" key={npc.id}><div className="person-head"><div className="avatar">{npc.avatar}</div><div><h3>{npc.name}</h3><span>{npc.role}</span></div><span className="person-score">+{npc.relationship}</span></div><p>{npc.summary}</p><div className="person-status"><span><Clock3 size={13} /> {npc.status}</span><small>最近：{npc.lastInteraction}</small></div><div className="relationship-track"><span style={{ width: `${Math.min(100, npc.relationship)}%` }} /></div></article>)}</div></div> }

function HistoryScreen({ state, onRollback }: { state: GameState; onRollback: (turn: number) => void }) { return <div className="page"><PageHeader eyebrow="人生履历" title="发生过的事，会留下来" copy="行动日志按时间保存。失败、错过和没有定论的事情同样属于你的人生。回到较早记录会保留当前人生，但撤销之后的变化。" /><section className="timeline">{state.history.map((event) => <article className="timeline-item" key={event.id}><div className="timeline-marker" /><div className="timeline-date">{event.date}</div><div className="timeline-content"><div className="timeline-title"><h3>{event.title}</h3><span className={`outcome-tag ${event.outcome}`}>{event.outcome === 'success' ? '已完成' : event.outcome === 'partial' ? '部分完成' : event.outcome === 'unknown' ? '待确认' : '未执行'}</span></div><p>{event.body}</p><div className="tag-row">{event.tags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</div>{event.turn !== undefined && event.turn < state.turn && <button className="history-rollback" type="button" onClick={() => onRollback(event.turn!)}><RotateCcw size={13} /> 回到第 {event.turn} 次记录</button>}</div></article>)}</section></div> }

function MapScreen({ state }: { state: GameState }) { return <div className="page"><PageHeader eyebrow="当前世界地图" title={state.world.region} copy="地图只显示你已经知道或走过的地方。未知区域不会因为你打开地图就自动出现。" /><div className="map-layout"><section className="map-canvas"><div className="map-water water-one" /><div className="map-water water-two" /><div className="map-road road-one" /><div className="map-road road-two" /><div className="map-hill map-hill-one" /><div className="map-hill map-hill-two" /><div className="map-label label-home"><Home size={14} />{state.world.location.split(' · ')[0]}</div>{state.locations.map((location, index) => { const Icon = iconForLocation(location.kind); return <button key={location.id} className={`map-pin pin-${index} ${location.name === state.world.location.split(' · ')[1] ? 'current' : ''}`} onClick={() => undefined}><span><Icon size={14} /></span><strong>{location.name}</strong></button> })}<div className="map-compass"><span>N</span><Compass size={38} /></div></section><aside className="location-list"><div className="panel-title"><span>已知地点</span><span className="panel-meta">{state.locations.length} 个</span></div>{state.locations.map((location) => { const Icon = iconForLocation(location.kind); return <div className="location-row" key={location.id}><div className="location-icon"><Icon size={16} /></div><div><strong>{location.name}</strong><span>{location.distance} · {location.kind}</span></div><ChevronRight size={16} /></div> })}</aside></div></div> }

function SettingsScreen({ script, actionMode, onActionModeChange, uiThemeId, onUiThemeChange, providerConfig, onProviderChange, onExport, onImport, onImportScript, onReset }: { script: ScriptPackage; actionMode: ActionGenerationMode; onActionModeChange: (mode: ActionGenerationMode) => void; uiThemeId: UiThemeId; onUiThemeChange: (themeId: UiThemeId) => void; providerConfig: ProviderConfig; onProviderChange: (config: Partial<ProviderConfig>) => void; onExport: () => void; onImport: () => void; onImportScript: () => void; onReset: () => void }) {
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null)
  const presetId = providerPresetId(providerConfig)
  const applyPreset = (id: string) => {
    const preset = providerPresets.find((item) => item.id === id)
    if (!preset || id === 'custom') return
    onProviderChange({ endpoint: preset.endpoint, model: preset.model })
    setConnectionResult(null)
  }
  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionResult(await checkProviderConnection(providerConfig))
    setTestingConnection(false)
  }
  const presetNote = providerPresets.find((preset) => preset.id === presetId)?.note ?? providerPresets[2].note
  return <div className="page"><PageHeader eyebrow="世界设置" title="让这个世界更适合你" copy="设置保存在当前设备。API Key 不会被上传到本项目的服务器。" /><div className="settings-grid"><section className="settings-panel"><div className="settings-heading"><div className="settings-icon"><Sparkles size={18} /></div><div><h2>模型连接</h2><p>可选。没有配置时使用本地确定性模拟。</p></div></div><label>快速选择模型<select aria-label="模型预设" value={presetId} onChange={(event) => applyPreset(event.target.value)}>{providerPresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}</select></label><p className="provider-preset-note">{presetNote}</p><label>OpenAI-compatible Endpoint<input aria-label="模型 Endpoint" value={providerConfig.endpoint} onChange={(event) => { onProviderChange({ endpoint: event.target.value }); setConnectionResult(null) }} /></label><label>Model<input aria-label="模型名称" value={providerConfig.model} onChange={(event) => { onProviderChange({ model: event.target.value }); setConnectionResult(null) }} /></label><label>API Key<input aria-label="模型 API Key" type="password" value={providerConfig.apiKey} onChange={(event) => { onProviderChange({ apiKey: event.target.value }); setConnectionResult(null) }} placeholder="请在此页面手动填写，不要发送到聊天" /></label><div className="connection-actions"><button className="primary-button" type="button" onClick={() => void testConnection()} disabled={testingConnection}>{testingConnection ? '正在测试…' : '测试连接'}</button><span className="provider-save-status">✓ 已自动保存到本设备</span>{connectionResult && <span className={`connection-result ${connectionResult.ok ? 'success' : 'error'}`} role="status"><span>{connectionResult.ok ? '✓' : '!'}</span>{connectionResult.message}{connectionResult.latencyMs ? ` · ${connectionResult.latencyMs}ms` : ''}</span>}</div><div className="settings-note"><ShieldCheck size={15} /><span>配置仅保存在此浏览器的本地 IndexedDB 中。开发环境会通过本机代理转发请求，避免浏览器跨域阻断；正式部署仍建议使用服务端网关。</span></div></section><section className="settings-panel action-mode-panel"><div className="settings-heading"><div className="settings-icon warm"><ListChecks size={18} /></div><div><h2>行动呈现方式</h2><p>决定每回合看到哪些行动入口。</p></div></div><div className="action-mode-options" role="radiogroup" aria-label="行动呈现方式">{actionModeOptions.map((option) => <label className={`action-mode-option ${actionMode === option.id ? 'active' : ''}`} key={option.id}><input type="radio" name="action-mode" value={option.id} checked={actionMode === option.id} onChange={() => onActionModeChange(option.id)} /><span className="action-mode-mark">{option.id === 'guided' ? <ListChecks size={16} /> : option.id === 'varied' ? <Shuffle size={16} /> : <PenLine size={16} />}</span><span className="action-mode-copy"><strong>{option.title}</strong><small>{option.description}</small></span>{actionMode === option.id && <Check className="action-mode-check" size={16} />}</label>)}</div><div className="settings-note"><Shuffle size={15} /><span>{getActionModeMeta(actionMode).detail}</span></div></section><section className="settings-panel theme-panel"><div className="settings-heading"><div className="settings-icon sky"><Sparkles size={18} /></div><div><h2>界面风格</h2><p>只改变呈现方式，不改变剧本规则和人生存档。</p></div></div><div className="ui-theme-options" role="radiogroup" aria-label="界面风格">{uiThemes.map((theme) => <label className={`ui-theme-option ${uiThemeId === theme.id ? 'active' : ''}`} key={theme.id}><input type="radio" name="ui-theme" value={theme.id} checked={uiThemeId === theme.id} onChange={() => onUiThemeChange(theme.id)} /><span className={`ui-theme-swatch ${theme.id}`} /><span className="ui-theme-copy"><strong>{theme.title}</strong><small>{theme.description}</small></span>{uiThemeId === theme.id && <Check className="action-mode-check" size={16} />}</label>)}</div><div className="settings-note"><Sparkles size={15} /><span>四种风格共用同一套操作结构，切换后仍能直接继续当前人生。</span></div></section><section className="settings-panel"><div className="settings-heading"><div className="settings-icon warm"><Database size={18} /></div><div><h2>存档管理</h2><p>把你的人生带到另一台设备。</p></div></div><div className="setting-actions"><button className="wide-button" onClick={onExport}><Download size={16} /> 导出全部世界存档</button><button className="wide-button secondary" onClick={onImport}><Upload size={16} /> 导入存档</button><button className="wide-button secondary" onClick={onImportScript}><BookOpen size={16} /> 导入剧本包</button></div><button className="danger-button" onClick={onReset}><RotateCcw size={15} /> 开始一段新人生</button></section><section className="settings-panel script-panel"><div className="settings-heading"><div className="settings-icon sky"><PanelRight size={18} /></div><div><h2>当前剧本世界</h2><p>剧本可以替换规则、内容和专属 UI，而地图属于当前剧本内部。</p></div></div><div className="capability-list">{script.manifest.capabilities.map((capability, index) => <span key={`${capability}-${index}`}><Check size={13} /> {capability}</span>)}</div><div className="package-status"><span className="status-dot" /> 运行时包已加载 <strong>.aiworld.json</strong></div></section></div></div>
}

function CharacterEditor({ state, script, onClose, onSave }: { state: GameState; script: ScriptPackage; onClose: () => void; onSave: (patch: Partial<GameState['player']>) => void }) {
  const config = script.characterCreation
  const selectedMap = script.maps?.find((map) => map.id === state.world.mapId)
  const currentStage = getAgeStageForAge(script, state.player.age)
  const [draft, setDraft] = useState({ name: state.player.name, age: String(state.player.age), role: state.player.role, profession: state.player.profession, mood: state.player.mood, traits: state.player.traits })
  const toggleTrait = (trait: string) => setDraft((current) => ({ ...current, traits: current.traits.includes(trait) ? current.traits.filter((item) => item !== trait) : [...current.traits, trait].slice(0, 4) }))
  const submit = (event: FormEvent) => { event.preventDefault(); if (!draft.name.trim()) return; onSave({ name: draft.name.trim(), age: Math.max(0, Math.min(120, Number(draft.age) || state.player.age)), role: draft.role, profession: draft.profession, mood: draft.mood, traits: draft.traits }) }
  const { roles, professions } = getAgeOptions(script, selectedMap, currentStage)
  const safeRoles = [...new Set(roles.length ? roles : [state.player.role])]
  const safeProfessions = [...new Set(professions.length ? professions : [state.player.profession])]
  const traits = config?.traits?.length ? config.traits : state.player.traits
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><form className="character-editor modal-panel" onSubmit={submit}><div className="modal-heading"><div><p className="eyebrow">角色编辑</p><h2>重新认识一下自己</h2><p>这些内容会保存到当前剧本，不会改写世界规则。</p></div><button type="button" className="icon-button" aria-label="关闭角色编辑" onClick={onClose}><X size={18} /></button></div><div className="editor-grid"><label>名字<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={20} /></label><label>年龄<input type="number" min="0" max="120" value={draft.age} onChange={(event) => setDraft({ ...draft, age: event.target.value })} /></label><label>身份<select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>{safeRoles.map((role) => <option key={role}>{role}</option>)}</select></label><label>职业<select value={draft.profession} onChange={(event) => setDraft({ ...draft, profession: event.target.value })}>{safeProfessions.map((profession) => <option key={profession}>{profession}</option>)}</select></label><label className="editor-wide">此刻心情<input value={draft.mood} onChange={(event) => setDraft({ ...draft, mood: event.target.value })} maxLength={30} /></label></div><fieldset className="trait-picker"><legend>初始特质</legend><div>{traits.map((trait, index) => <button type="button" key={`${trait}-${index}`} className={draft.traits.includes(trait) ? 'selected' : ''} onClick={() => toggleTrait(trait)}>{draft.traits.includes(trait) && <Check size={13} />}{trait}</button>)}</div></fieldset><div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>取消</button><button type="submit" className="primary-button"><Check size={15} /> 保存档案</button></div></form></div>
}

function NewLifeModal({ state, script, onClose, onStart }: { state: GameState; script: ScriptPackage; onClose: () => void; onStart: (setup: { mapId?: string; ageStage?: GameState['player']['ageStage']; player?: Partial<GameState['player']> }) => void }) {
  const maps = script.maps ?? []
  const ageStages = getAgeStageDefinitions(script)
  const [mapId, setMapId] = useState(state.world.mapId ?? script.world.startingMapId ?? maps[0]?.id)
  const selectedMap = maps.find((map) => map.id === mapId) ?? maps[0]
  const initialStage = ageStages.find((stage) => state.player.age >= stage.minAge && state.player.age <= stage.maxAge)?.id ?? 'adult'
  const initialOptions = getAgeOptions(script, selectedMap, initialStage)
  const [draft, setDraft] = useState({ name: state.player.name, age: String(state.player.age), ageStage: initialStage, role: initialOptions.roles.includes(state.player.role) ? state.player.role : initialOptions.roles[0] ?? state.player.role, profession: initialOptions.professions.includes(state.player.profession) ? state.player.profession : initialOptions.professions[0] ?? state.player.profession, traits: state.player.traits })
  const selectedOptions = getAgeOptions(script, selectedMap, draft.ageStage)
  const roles = selectedOptions.roles.length ? selectedOptions.roles : [state.player.role]
  const professions = selectedOptions.professions.length ? selectedOptions.professions : [state.player.profession]
  const traits = script.characterCreation?.traits?.length ? script.characterCreation.traits : state.player.traits
  const setMap = (nextMapId: string) => {
    const nextMap = maps.find((map) => map.id === nextMapId)
    setMapId(nextMapId)
    const options = getAgeOptions(script, nextMap, draft.ageStage)
    setDraft((current) => ({ ...current, role: options.roles.includes(current.role) ? current.role : options.roles[0] ?? current.role, profession: options.professions.includes(current.profession) ? current.profession : options.professions[0] ?? current.profession }))
  }
  const setStage = (stageId: string) => {
    const stage = ageStages.find((item) => item.id === stageId)
    const options = getAgeOptions(script, selectedMap, stageId as typeof draft.ageStage)
    setDraft((current) => ({ ...current, ageStage: stageId as typeof current.ageStage, age: stage ? String(stage.minAge) : current.age, role: options.roles[0] ?? current.role, profession: options.professions[0] ?? current.profession }))
  }
  const randomize = () => {
    const randomMap = maps[Math.floor(Math.random() * Math.max(1, maps.length))] ?? selectedMap
    const randomStage = ageStages[Math.floor(Math.random() * Math.max(1, ageStages.length))]
    const randomOptions = getAgeOptions(script, randomMap, randomStage?.id ?? draft.ageStage)
    const nextRoles = randomOptions.roles.length ? randomOptions.roles : roles
    const nextProfessions = randomOptions.professions.length ? randomOptions.professions : professions
    setMapId(randomMap?.id)
    setDraft((current) => ({ ...current, ageStage: randomStage?.id ?? current.ageStage, age: String(randomStage?.minAge ?? current.age), role: nextRoles[Math.floor(Math.random() * nextRoles.length)] ?? current.role, profession: nextProfessions[Math.floor(Math.random() * nextProfessions.length)] ?? current.profession }))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim()) return
    const stage = ageStages.find((item) => item.id === draft.ageStage)
    const age = stage ? Math.max(stage.minAge, Math.min(stage.maxAge, Number(draft.age) || stage.minAge)) : Math.max(0, Math.min(120, Number(draft.age) || state.player.age))
    onStart({ mapId, ageStage: draft.ageStage, player: { name: draft.name.trim(), age, ageStage: draft.ageStage, role: draft.role, profession: draft.profession, traits: draft.traits } })
  }
  const toggleTrait = (trait: string) => setDraft((current) => ({ ...current, traits: current.traits.includes(trait) ? current.traits.filter((item) => item !== trait) : [...current.traits, trait].slice(0, 4) }))
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><form className="new-life-modal modal-panel" onSubmit={submit}><div className="modal-heading"><div><p className="eyebrow">人生起点</p><h2>开始一段新人生</h2><p>仍然生活在《{script.manifest.title}》中，但这一次可以重新选择名字、年龄、身份和地图。</p></div><button type="button" className="icon-button" aria-label="关闭新人生设置" onClick={onClose}><X size={18} /></button></div><div className="editor-grid"><label>名字<input autoFocus required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={20} /></label><label>年龄<input type="number" min="0" max="120" value={draft.age} onChange={(event) => setDraft({ ...draft, age: event.target.value })} /></label><label>年龄阶段<select value={draft.ageStage} onChange={(event) => setStage(event.target.value)}>{ageStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label} · {stage.minAge}-{stage.maxAge}岁</option>)}</select></label><label>身份<select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>{roles.map((role, index) => <option key={`${role}-${index}`}>{role}</option>)}</select></label><label>职业<select value={draft.profession} onChange={(event) => setDraft({ ...draft, profession: event.target.value })}>{professions.map((profession, index) => <option key={`${profession}-${index}`}>{profession}</option>)}</select></label></div>{ageStages.find((stage) => stage.id === draft.ageStage) && <p className="life-stage-note">{ageStages.find((stage) => stage.id === draft.ageStage)?.description}</p>}<section className="life-map-section"><div className="life-section-heading"><div><p className="eyebrow">出生地与生活圈</p><h3>选择你要从哪里开始</h3></div><button type="button" className="quiet-button compact" onClick={randomize}><Shuffle size={14} /> 随机一套</button></div><div className="life-map-options">{maps.map((map, index) => <button type="button" key={`${map.id}-${index}`} className={`life-map-option ${selectedMap?.id === map.id ? 'active' : ''}`} onClick={() => setMap(map.id)}><strong>{map.title}</strong><span>{map.subtitle}</span><small>{map.description}</small></button>)}</div></section><fieldset className="trait-picker"><legend>初始特质</legend><div>{traits.map((trait, index) => <button type="button" key={`${trait}-${index}`} className={draft.traits.includes(trait) ? 'selected' : ''} onClick={() => toggleTrait(trait)}>{draft.traits.includes(trait) && <Check size={13} />}{trait}</button>)}</div></fieldset><div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>取消</button><button type="submit" className="primary-button"><Sparkles size={15} /> 开始这段人生</button></div></form></div>
}

function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) { return <section className="page-heading inner-heading"><div><p className="eyebrow"><span className="eyebrow-line" />{eyebrow}</p><h1>{title}</h1><p className="heading-copy">{copy}</p></div>{action}</section> }

export default App
