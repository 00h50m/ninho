'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/AppContext'
import { TaskCard } from '@/components/TaskCard'
import { TaskModal } from '@/components/TaskModal'
import { formatGreeting, getChaosLabel, getCurrentLevel, CATEGORY_LABELS, getWeekStart } from '@/lib/utils'
import {
  Plus, Settings, Zap, Shield, ChevronRight, Check,
  Flame, LayoutDashboard, List
} from 'lucide-react'

type ViewMode = 'pass' | 'expanded'

export function Dashboard() {
  const {
    profile, partner, tasks, dogs,
    totalXP, chaosLevel, energyLevel,
    isSurvivalMode, completeTask, uncompleteTask,
    completeDogRoutine, setEnergy, toggleSurvivalMode,
  } = useApp()

  const [mode, setMode]             = useState<ViewMode>('pass')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showEnergy, setShowEnergy] = useState(false)
  const [editTask, setEditTask]     = useState<any>(null)
  const [toastMsg, setToastMsg]     = useState('')

  const toast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  // Separar tarefas por pessoa
  const myTasks      = tasks.filter(t => !t.assigned_to || t.assigned_to === profile?.id)
  const partnerTasks = tasks.filter(t => partner && t.assigned_to === partner.id)
  const sharedTasks  = tasks.filter(t => !t.assigned_to)

  const myPending    = myTasks.filter(t => !t.completed_today)
  const myDone       = myTasks.filter(t => t.completed_today)
  const pPending     = partnerTasks.filter(t => !t.completed_today)
  const pDone        = partnerTasks.filter(t => t.completed_today)

  // Agrupar por categoria para modo expandido
  const groupByCategory = (list: typeof tasks) => {
    const groups: Record<string, typeof tasks> = {}
    list.forEach(t => {
      if (!groups[t.category]) groups[t.category] = []
      groups[t.category].push(t)
    })
    return groups
  }

  const myGroups = groupByCategory([...myPending, ...myDone])
  const pGroups  = groupByCategory([...pPending, ...pDone])

  const level    = getCurrentLevel(totalXP)
  const nextLevel = totalXP < 1000 ? 1000 : 9999
  const xpPct    = Math.min(100, Math.round((totalXP / nextLevel) * 100))
  const chaos    = getChaosLabel(chaosLevel)

  const greeting = formatGreeting()
  const names    = [profile?.name, partner?.name].filter(Boolean).join(' e ')

  // streak (placeholder — seria calculado do banco)
  const streakDays = ['S','T','Q','Q','S','S','D']
  const streakDone = [true, true, true, false, false, false, false]

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── TOAST ─────────────────────────── */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-green-bg border border-brand-green rounded-xl px-4 py-2.5 text-brand-green text-sm flex items-center gap-2 animate-slide-up shadow-lg">
          <Check size={14} /> {toastMsg}
        </div>
      )}

      {/* ── SURVIVAL BANNER ───────────────── */}
      {isSurvivalMode && (
        <div className="bg-[#2a0e08] border-b border-[#5a2010] px-4 py-2.5 flex items-center gap-2 text-[#d85a30] text-xs">
          <Shield size={13} />
          <span className="flex-1">Modo sobrevivência ativo — só o essencial esta semana</span>
          <button onClick={toggleSurvivalMode} className="underline opacity-70">desativar</button>
        </div>
      )}

      {/* ── MODE BAR ──────────────────────── */}
      <div className="flex bg-brand-surface border-b border-brand-border">
        <button
          onClick={() => setMode('pass')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium border-b-2 transition-all ${mode === 'pass' ? 'text-brand-text border-brand-warm' : 'text-brand-subtle border-transparent'}`}
        >
          <LayoutDashboard size={13} /> Modo passagem
        </button>
        <button
          onClick={() => setMode('expanded')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium border-b-2 transition-all ${mode === 'expanded' ? 'text-brand-text border-brand-warm' : 'text-brand-subtle border-transparent'}`}
        >
          <List size={13} /> Modo expandido
        </button>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-auto">

        {/* ── TOPBAR ────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-medium">{greeting}, {names || 'bem-vindas'}</div>
            <div className="text-xs text-brand-subtle mt-0.5">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${
              energyLevel === 'high'   ? 'bg-brand-green-bg border-brand-green text-brand-green' :
              energyLevel === 'medium' ? 'bg-amber-900/30 border-brand-amber text-brand-amber' :
                                         'bg-orange-900/30 border-brand-coral text-brand-coral'
            }`}>
              {energyLevel === 'high' ? '🌿 Alta' : energyLevel === 'medium' ? '🌤 Média' : '🌧 Baixa'}
            </span>
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-amber-900/30 border border-brand-amber text-brand-amber">
              Nível {level.level} · {level.name}
            </span>
          </div>
        </div>

        {/* ════════════════════════════════════
            MODO PASSAGEM
        ════════════════════════════════════ */}
        {mode === 'pass' && (
          <>
            {/* cards das pessoas */}
            <div className="grid grid-cols-2 gap-3">
              {/* Eu */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2.5 pb-2.5 border-b border-brand-border">
                  <div className="w-6 h-6 rounded-full bg-brand-green-bg flex items-center justify-center text-[9px] font-medium text-brand-green">
                    {profile?.name?.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{profile?.name ?? 'Você'}</div>
                  </div>
                  <span className="text-[10px] text-brand-subtle">
                    <span className="text-brand-green font-medium">{myDone.length}</span>/{myTasks.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {myPending.slice(0,4).map(t => (
                    <TaskCard key={t.id} task={t} compact showXP={false} />
                  ))}
                  {myDone.slice(0,2).map(t => (
                    <TaskCard key={t.id} task={t} compact showXP={false} />
                  ))}
                  {myPending.length > 4 && (
                    <button
                      onClick={() => setMode('expanded')}
                      className="w-full mt-1.5 text-center text-[10px] text-brand-subtle border border-dashed border-brand-border rounded-lg py-1.5 hover:border-brand-border2 transition-colors"
                    >
                      +{myPending.length - 4} tarefas · ver tudo
                    </button>
                  )}
                  {myTasks.length === 0 && (
                    <div className="text-[10px] text-brand-faint text-center py-2">sem tarefas hoje</div>
                  )}
                </div>
              </div>

              {/* Parceira */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2.5 pb-2.5 border-b border-brand-border">
                  <div className="w-6 h-6 rounded-full bg-brand-purple-bg flex items-center justify-center text-[9px] font-medium text-brand-purple">
                    {partner?.name?.slice(0,2).toUpperCase() ?? '??'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{partner?.name ?? 'Parceira'}</div>
                  </div>
                  <span className="text-[10px] text-brand-subtle">
                    <span className="text-brand-green font-medium">{pDone.length}</span>/{partnerTasks.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {pPending.slice(0,4).map(t => (
                    <TaskCard key={t.id} task={t} compact showXP={false} />
                  ))}
                  {pDone.slice(0,2).map(t => (
                    <TaskCard key={t.id} task={t} compact showXP={false} />
                  ))}
                  {pPending.length > 4 && (
                    <button
                      onClick={() => setMode('expanded')}
                      className="w-full mt-1.5 text-center text-[10px] text-brand-subtle border border-dashed border-brand-border rounded-lg py-1.5"
                    >
                      +{pPending.length - 4} tarefas · ver tudo
                    </button>
                  )}
                  {partnerTasks.length === 0 && (
                    <div className="text-[10px] text-brand-faint text-center py-2">sem tarefas atribuídas</div>
                  )}
                </div>
              </div>
            </div>

            {/* bottom strip */}
            <div className="grid grid-cols-3 gap-3">
              {/* XP */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-1">XP do casal</div>
                <div className="text-xl font-medium">{totalXP}</div>
                <div className="text-[10px] text-brand-subtle mb-1.5">/ {nextLevel}</div>
                <div className="bg-brand-surface2 rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${xpPct}%` }} />
                </div>
              </div>

              {/* Casa */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-1">Casa</div>
                <div className="text-sm font-medium" style={{ color: chaos.color }}>{chaos.label}</div>
                <div className="text-[10px] text-brand-subtle mb-1.5">Caos: {chaosLevel}%</div>
                <div className="bg-brand-surface2 rounded-full h-1 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${chaosLevel}%`, background: chaos.color }} />
                </div>
              </div>

              {/* Cães */}
              <div className="bg-brand-green-bg border border-brand-green-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-[#2d8a5a] uppercase tracking-wider mb-2">🐾 Cães</div>
                {dogs.flatMap(dog => dog.routines.filter(r => r.frequency === 'daily').slice(0,3)).map(r => (
                  <div
                    key={r.id}
                    onClick={() => completeDogRoutine(r.id, dogs.find(d => d.routines.some(x => x.id === r.id))!.id)}
                    className="flex items-center gap-1.5 py-1 cursor-pointer interactive"
                  >
                    <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${r.completed_today ? 'bg-brand-green border-brand-green' : 'border-[#2d5a42]'}`}>
                      {r.completed_today && <Check size={8} strokeWidth={3} className="text-brand-bg" />}
                    </div>
                    <span className="text-[10px] text-brand-green truncate">{r.title}</span>
                  </div>
                ))}
                {dogs.length === 0 && <div className="text-[10px] text-brand-green opacity-50">Adicionar pet</div>}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════
            MODO EXPANDIDO
        ════════════════════════════════════ */}
        {mode === 'expanded' && (
          <div className="grid grid-cols-[1fr_1fr_180px] gap-3">

            {/* COLUNA: Eu */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-brand-border">
                <div className="w-6 h-6 rounded-full bg-brand-green-bg flex items-center justify-center text-[9px] font-medium text-brand-green">
                  {profile?.name?.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-medium">{profile?.name ?? 'Você'}</div>
                  <div className="text-[10px] text-brand-subtle">home office</div>
                </div>
                <span className="ml-auto text-[10px]">
                  <span className="text-brand-green font-medium">{myDone.length}</span>
                  <span className="text-brand-faint"> / {myTasks.length} feitas</span>
                </span>
              </div>

              {/* pendentes por categoria */}
              {Object.entries(myGroups).map(([cat, catTasks]) => {
                const pending = catTasks.filter(t => !t.completed_today)
                const done    = catTasks.filter(t => t.completed_today)
                return (
                  <div key={cat} className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-medium text-brand-faint uppercase tracking-wider">{CATEGORY_LABELS[cat] ?? cat}</span>
                      <div className="flex-1 h-px bg-brand-surface2" />
                    </div>
                    {pending.map(t => <TaskCard key={t.id} task={t} showXP onSwap={() => toast('Troca oferecida!')} />)}
                    {done.map(t => <TaskCard key={t.id} task={t} showXP />)}
                  </div>
                )
              })}

              {myTasks.length === 0 && (
                <div className="text-center py-6 text-xs text-brand-faint">
                  Nenhuma tarefa. <br/>
                  <button onClick={() => setShowTaskModal(true)} className="text-brand-green mt-1 underline">Adicionar tarefa</button>
                </div>
              )}

              {/* XP footer */}
              <div className="mt-3 pt-3 border-t border-brand-border flex justify-between text-[10px]">
                <span className="text-brand-faint">XP hoje</span>
                <span className="text-brand-text font-medium">+{myDone.reduce((s,t)=>s+t.xp_value,0)} XP</span>
                <span className="text-brand-faint">semana</span>
                <span className="text-brand-text font-medium">{totalXP} XP</span>
              </div>
            </div>

            {/* COLUNA: Parceira */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-brand-border">
                <div className="w-6 h-6 rounded-full bg-brand-purple-bg flex items-center justify-center text-[9px] font-medium text-brand-purple">
                  {partner?.name?.slice(0,2).toUpperCase() ?? '??'}
                </div>
                <div>
                  <div className="text-xs font-medium">{partner?.name ?? 'Parceira'}</div>
                  <div className="text-[10px] text-brand-subtle">professora</div>
                </div>
                <span className="ml-auto text-[10px]">
                  <span className="text-brand-green font-medium">{pDone.length}</span>
                  <span className="text-brand-faint"> / {partnerTasks.length} feitas</span>
                </span>
              </div>

              {Object.entries(pGroups).map(([cat, catTasks]) => {
                const pending = catTasks.filter(t => !t.completed_today)
                const done    = catTasks.filter(t => t.completed_today)
                return (
                  <div key={cat} className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-medium text-brand-faint uppercase tracking-wider">{CATEGORY_LABELS[cat] ?? cat}</span>
                      <div className="flex-1 h-px bg-brand-surface2" />
                    </div>
                    {pending.map(t => <TaskCard key={t.id} task={t} showXP />)}
                    {done.map(t => <TaskCard key={t.id} task={t} showXP />)}
                  </div>
                )
              })}

              {partnerTasks.length === 0 && (
                <div className="text-center py-6 text-xs text-brand-faint">Sem tarefas atribuídas</div>
              )}

              <div className="mt-3 pt-3 border-t border-brand-border flex justify-between text-[10px]">
                <span className="text-brand-faint">XP hoje</span>
                <span className="text-brand-text font-medium">+{pDone.reduce((s,t)=>s+t.xp_value,0)} XP</span>
              </div>
            </div>

            {/* SIDEBAR */}
            <div className="space-y-3">
              {/* XP */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-1">XP do casal</div>
                <div className="text-2xl font-medium">{totalXP}</div>
                <div className="text-[10px] text-brand-subtle mb-2">/ {nextLevel} · +{nextLevel - totalXP} para Nível {level.level + 1}</div>
                <div className="bg-brand-surface2 rounded-full h-1 overflow-hidden mb-2">
                  <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${xpPct}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-brand-surface2 rounded-lg p-2 text-center">
                    <div className="text-[9px] text-brand-faint">{profile?.name}</div>
                    <div className="text-xs font-medium">{myDone.reduce((s,t)=>s+t.xp_value,0)}</div>
                  </div>
                  <div className="bg-brand-surface2 rounded-lg p-2 text-center">
                    <div className="text-[9px] text-brand-faint">{partner?.name}</div>
                    <div className="text-xs font-medium">{pDone.reduce((s,t)=>s+t.xp_value,0)}</div>
                  </div>
                </div>
              </div>

              {/* Casa */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-1">Estado da casa</div>
                <div className="text-sm font-medium mb-0.5" style={{ color: chaos.color }}>{chaos.label}</div>
                <div className="text-[10px] text-brand-subtle mb-2">Caos: {chaosLevel}%</div>
                <div className="bg-brand-surface2 rounded-full h-1 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${chaosLevel}%`, background: chaos.color }} />
                </div>
              </div>

              {/* Cães */}
              <div className="bg-brand-green-bg border border-brand-green-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-[#2d8a5a] uppercase tracking-wider mb-2">🐾 Cães</div>
                {dogs.map(dog => (
                  <div key={dog.id}>
                    <div className="text-[10px] font-medium text-brand-green mb-1.5">{dog.name}</div>
                    {dog.routines.map(r => (
                      <div
                        key={r.id}
                        onClick={() => completeDogRoutine(r.id, dog.id)}
                        className="flex items-center gap-2 py-1.5 border-b border-[#1a3a2a] last:border-0 cursor-pointer interactive"
                      >
                        <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${r.completed_today ? 'bg-brand-green border-brand-green' : 'border-[#2d5a42]'}`}>
                          {r.completed_today && <Check size={9} strokeWidth={3} className="text-brand-bg" />}
                        </div>
                        <span className="text-[10px] text-brand-green flex-1 truncate">{r.title}</span>
                        {r.assigned_to === profile?.id && <span className="text-[8px] text-[#2d8a5a]">você</span>}
                        {r.assigned_to === partner?.id && <span className="text-[8px] text-[#2d8a5a]">{partner.name}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Streak */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-2">Streak</div>
                <div className="flex gap-1">
                  {streakDays.map((d, i) => (
                    <div key={d} className={`flex-1 h-5 rounded-sm flex items-center justify-center text-[8px] font-medium transition-colors ${streakDone[i] ? 'bg-brand-amber text-brand-bg' : i === 2 ? 'border-2 border-brand-amber text-brand-amber' : 'bg-brand-surface2 text-brand-faint'}`}>
                      {d}
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões */}
              <button
                onClick={() => setShowEnergy(!showEnergy)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-xs text-brand-subtle hover:text-brand-muted interactive"
              >
                <Zap size={13} /> Energia da semana
              </button>

              {showEnergy && (
                <div className="bg-brand-surface border border-brand-border rounded-xl p-3 space-y-1.5 animate-slide-up">
                  {(['high','medium','low'] as const).map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => { setEnergy(lvl); setShowEnergy(false); toast('Energia atualizada!') }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-colors ${energyLevel === lvl ? 'bg-brand-green-bg border-brand-green text-brand-green' : 'bg-brand-surface2 border-brand-border text-brand-subtle'}`}
                    >
                      {lvl === 'high' ? '🌿 Alta energia' : lvl === 'medium' ? '🌤 Energia média' : '🌧 Baixa energia'}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => { toggleSurvivalMode(); toast(isSurvivalMode ? 'Modo normal ativado!' : 'Modo sobrevivência ativado.') }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs interactive border ${isSurvivalMode ? 'bg-brand-green-bg border-brand-green text-brand-green' : 'bg-[#1a0c08] border-[#5a2010] text-brand-coral'}`}
              >
                <Shield size={13} />
                {isSurvivalMode ? 'Desativar modo sobrevivência' : 'Ativar modo sobrevivência'}
              </button>
            </div>

          </div>
        )}

        {/* ── FAB: nova tarefa ─────────────── */}
        <button
          onClick={() => setShowTaskModal(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-brand-green rounded-full flex items-center justify-center shadow-lg interactive z-40"
          title="Nova tarefa"
        >
          <Plus size={22} className="text-brand-bg" strokeWidth={2.5} />
        </button>

      </div>

      {/* ── MODALS ─────────────────────────── */}
      {(showTaskModal || editTask) && (
        <TaskModal
          onClose={() => { setShowTaskModal(false); setEditTask(null) }}
          editTask={editTask}
        />
      )}
    </div>
  )
}
