'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/AppContext'
import { TaskModal } from '@/components/TaskModal'
import { PetModal } from '@/components/PetModal'
import { SuggestionsModal } from '@/components/SuggestionsModal'
import { formatGreeting, getChaosLabel, getCurrentLevel, CATEGORY_LABELS } from '@/lib/utils'
import { Plus, Zap, Shield, Check, LayoutDashboard, List, PawPrint, Shuffle, Sparkles, Settings } from 'lucide-react'

type ViewMode = 'pass' | 'expanded'

const WEIGHT_DOT: Record<string, string> = {
  light: 'bg-brand-green',
  medium: 'bg-brand-amber',
  heavy: 'bg-brand-coral',
}

export function Dashboard() {
  const {
    profile, partner, tasks, dogs,
    totalXP, chaosLevel, energyLevel,
    isSurvivalMode, completeTask, uncompleteTask,
    completeDogRoutine, setEnergy, toggleSurvivalMode, refreshAll,
  } = useApp()

  const [mode, setMode]                   = useState<ViewMode>('pass')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showPetModal, setShowPetModal]   = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showEnergy, setShowEnergy]       = useState(false)
  const [editTask, setEditTask]           = useState<any>(null)
  const [toast, setToast]                 = useState('')
  const [swapping, setSwapping]           = useState<string | null>(null)

  function fireToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function toggleTask(task: any) {
    if (task.completed_today && task.completed_by_me) {
      await uncompleteTask(task.id)
    } else if (!task.completed_today) {
      await completeTask(task.id)
      fireToast('+' + task.xp_value + ' XP · ' + task.title)
    }
  }

  async function swapTask(task: any) {
    if (!partner) return
    setSwapping(task.id)
    const { supabase } = await import('@/lib/supabase')
    const newOwner = task.assigned_to === profile?.id ? partner.id : profile?.id
    await supabase.from('tasks').update({ assigned_to: newOwner }).eq('id', task.id)
    await refreshAll()
    setSwapping(null)
    fireToast('Tarefa transferida para ' + (newOwner === partner.id ? partner.name : profile?.name))
  }

  // Separar tarefas
  const myTasks      = tasks.filter(t => !t.assigned_to || t.assigned_to === profile?.id)
  const partnerTasks = tasks.filter(t => partner && t.assigned_to === partner.id)
  const myPending    = myTasks.filter(t => !t.completed_today)
  const myDone       = myTasks.filter(t => t.completed_today)
  const pPending     = partnerTasks.filter(t => !t.completed_today)
  const pDone        = partnerTasks.filter(t => t.completed_today)

  // Agrupar por categoria
  function groupBy(list: typeof tasks) {
    const g: Record<string, typeof tasks> = {}
    list.forEach(t => { if (!g[t.category]) g[t.category] = []; g[t.category].push(t) })
    return g
  }

  const level    = getCurrentLevel(totalXP)
  const xpNext   = level.max
  const xpPct    = Math.min(100, Math.round(((totalXP - level.min) / (level.max - level.min)) * 100))
  const chaos    = getChaosLabel(chaosLevel)
  const greeting = formatGreeting()

  const streakDays = ['S','T','Q','Q','S','S','D']
  const todayIdx   = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  const streakDone = streakDays.map((_, i) => i < todayIdx)

  // Componente de tarefa inline
  function TaskRow({ task, showSwap = false, compact = false }: { task: any, showSwap?: boolean, compact?: boolean }) {
    const done = task.completed_today
    const spinning = swapping === task.id
    return (
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all cursor-pointer group ${done ? 'opacity-30' : 'hover:bg-brand-surface2'} ${compact ? '' : ''}`}>
        <div
          onClick={() => toggleTask(task)}
          className={`w-4 h-4 min-w-[16px] rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-brand-green border-brand-green' : 'border-brand-border2 group-hover:border-brand-green'}`}
        >
          {done && <Check size={9} strokeWidth={3} className="text-brand-bg" />}
        </div>
        <span onClick={() => toggleTask(task)} className={`flex-1 text-xs ${done ? 'line-through text-brand-subtle' : 'text-brand-muted'}`}>
          {task.title}
        </span>
        {task.scheduled_time && (
          <span className="text-[9px] text-brand-faint bg-brand-surface2 px-1.5 py-0.5 rounded">
            {task.scheduled_time.slice(0,5)}
          </span>
        )}
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${WEIGHT_DOT[task.weight]}`} />
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${done ? 'text-brand-green bg-brand-green-bg' : 'text-brand-faint bg-brand-surface2'}`}>
          +{task.xp_value}
        </span>
        {showSwap && !done && (
          <button
            onClick={e => { e.stopPropagation(); swapTask(task) }}
            className={`text-brand-faint hover:text-brand-amber p-0.5 rounded transition-colors flex-shrink-0 ${spinning ? 'animate-spin' : ''}`}
            title="Trocar responsável"
          >
            <Shuffle size={11} />
          </button>
        )}
        {!compact && !done && (
          <button
            onClick={e => { e.stopPropagation(); setEditTask(task) }}
            className="text-brand-faint hover:text-brand-subtle p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <Settings size={10} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col select-none">

      {/* TOAST */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-green-bg border border-brand-green rounded-xl px-4 py-2.5 text-brand-green text-xs flex items-center gap-2 animate-slide-up shadow-xl whitespace-nowrap">
          <Check size={12} /> {toast}
        </div>
      )}

      {/* SURVIVAL BANNER */}
      {isSurvivalMode && (
        <div className="bg-[#2a0e08] border-b border-[#5a2010] px-4 py-2 flex items-center gap-2 text-[#d85a30] text-xs">
          <Shield size={12} />
          <span className="flex-1">Modo sobrevivência ativo — foco no essencial</span>
          <button onClick={toggleSurvivalMode} className="underline opacity-60 text-[10px]">desativar</button>
        </div>
      )}

      {/* MODE BAR */}
      <div className="flex bg-brand-surface border-b border-brand-border sticky top-0 z-30">
        <button onClick={() => setMode('pass')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-all ${mode === 'pass' ? 'text-brand-text border-brand-warm' : 'text-brand-subtle border-transparent'}`}>
          <LayoutDashboard size={12} /> Modo passagem
        </button>
        <button onClick={() => setMode('expanded')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-all ${mode === 'expanded' ? 'text-brand-text border-brand-warm' : 'text-brand-subtle border-transparent'}`}>
          <List size={12} /> Modo expandido
        </button>
      </div>

      <div className="flex-1 p-3 overflow-auto">

        {/* TOPBAR */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-base font-medium">{greeting}, {profile?.name ?? 'Giovanna'}</div>
            <div className="text-xs text-brand-subtle mt-0.5 capitalize">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={() => setShowEnergy(!showEnergy)} className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
              energyLevel === 'high'   ? 'bg-brand-green-bg border-brand-green text-brand-green' :
              energyLevel === 'medium' ? 'bg-amber-900/30 border-brand-amber text-brand-amber' :
                                         'bg-orange-900/30 border-brand-coral text-brand-coral'
            }`}>
              {energyLevel === 'high' ? '🌿 Alta' : energyLevel === 'medium' ? '🌤 Média' : '🌧 Baixa'}
            </button>
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-amber-900/30 border border-brand-amber text-brand-amber">
              Nível {level.level} · {level.name}
            </span>
          </div>
        </div>

        {/* ENERGY PICKER */}
        {showEnergy && (
          <div className="grid grid-cols-3 gap-2 mb-3 animate-slide-up">
            {(['high','medium','low'] as const).map(lvl => (
              <button key={lvl} onClick={() => { setEnergy(lvl); setShowEnergy(false); fireToast('Energia atualizada!') }}
                className={`py-2 rounded-xl text-xs border transition-colors ${energyLevel === lvl ? 'bg-brand-green-bg border-brand-green text-brand-green' : 'bg-brand-surface border-brand-border text-brand-subtle'}`}>
                {lvl === 'high' ? '🌿 Alta' : lvl === 'medium' ? '🌤 Média' : '🌧 Baixa'}
              </button>
            ))}
          </div>
        )}

        {/* ═══ MODO PASSAGEM ═══ */}
        {mode === 'pass' && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Giovanna */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-brand-border">
                  <div className="w-7 h-7 rounded-full bg-brand-green-bg flex items-center justify-center text-[10px] font-medium text-brand-green flex-shrink-0">
                    {(profile?.name ?? 'GI').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{profile?.name ?? 'Giovanna'}</div>
                    <div className="text-[10px] text-brand-subtle">home office</div>
                  </div>
                  <span className="text-[10px] flex-shrink-0">
                    <span className="text-brand-green font-medium">{myDone.length}</span>
                    <span className="text-brand-faint">/{myTasks.length}</span>
                  </span>
                </div>
                {myPending.length === 0 && myDone.length === 0 && (
                  <div className="text-[10px] text-brand-faint text-center py-3">
                    Nenhuma tarefa hoje.<br/>
                    <button onClick={() => setShowSuggestions(true)} className="text-brand-green underline mt-1">Adicionar sugestões</button>
                  </div>
                )}
                {myPending.slice(0,4).map(t => <TaskRow key={t.id} task={t} compact />)}
                {myDone.slice(0,2).map(t => <TaskRow key={t.id} task={t} compact />)}
                {myPending.length > 4 && (
                  <button onClick={() => setMode('expanded')} className="w-full mt-2 text-center text-[10px] text-brand-subtle border border-dashed border-brand-border rounded-lg py-1.5">
                    +{myPending.length - 4} tarefas · ver tudo
                  </button>
                )}
              </div>

              {/* Sabrina */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-brand-border">
                  <div className="w-7 h-7 rounded-full bg-brand-purple-bg flex items-center justify-center text-[10px] font-medium text-brand-purple flex-shrink-0">
                    {(partner?.name ?? 'SA').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{partner?.name ?? 'Sabrina'}</div>
                    <div className="text-[10px] text-brand-subtle">professora</div>
                  </div>
                  <span className="text-[10px] flex-shrink-0">
                    <span className="text-brand-green font-medium">{pDone.length}</span>
                    <span className="text-brand-faint">/{partnerTasks.length}</span>
                  </span>
                </div>
                {pPending.length === 0 && pDone.length === 0 && (
                  <div className="text-[10px] text-brand-faint text-center py-3">Sem tarefas atribuídas</div>
                )}
                {pPending.slice(0,4).map(t => <TaskRow key={t.id} task={t} compact />)}
                {pDone.slice(0,2).map(t => <TaskRow key={t.id} task={t} compact />)}
                {pPending.length > 4 && (
                  <button onClick={() => setMode('expanded')} className="w-full mt-2 text-center text-[10px] text-brand-subtle border border-dashed border-brand-border rounded-lg py-1.5">
                    +{pPending.length - 4} · ver tudo
                  </button>
                )}
              </div>
            </div>

            {/* BOTTOM STRIP */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-1">XP do casal</div>
                <div className="text-xl font-medium">{totalXP}</div>
                <div className="text-[10px] text-brand-subtle mb-2">/ {xpNext}</div>
                <div className="bg-brand-surface2 rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: xpPct + '%' }} />
                </div>
              </div>
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-1">Casa</div>
                <div className="text-sm font-medium mb-0.5" style={{ color: chaos.color }}>{chaos.label}</div>
                <div className="text-[10px] text-brand-subtle mb-2">Caos: {chaosLevel}%</div>
                <div className="bg-brand-surface2 rounded-full h-1 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: chaosLevel + '%', background: chaos.color }} />
                </div>
              </div>
              <div
                onClick={() => setShowPetModal(true)}
                className="bg-brand-green-bg border border-brand-green-border rounded-xl p-3 cursor-pointer hover:border-brand-green transition-colors"
              >
                <div className="text-[9px] font-medium text-[#2d8a5a] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <PawPrint size={10} /> Cães
                </div>
                {dogs.length === 0 ? (
                  <div className="text-[10px] text-brand-green opacity-60 flex items-center gap-1">
                    <Plus size={10} /> Cadastrar pet
                  </div>
                ) : (
                  dogs.flatMap(d => d.routines.filter((r: any) => r.frequency === 'daily').slice(0,3)).map((r: any) => (
                    <div key={r.id} onClick={e => { e.stopPropagation(); completeDogRoutine(r.id, dogs.find((d: any) => d.routines.some((x: any) => x.id === r.id))!.id) }}
                      className="flex items-center gap-1.5 py-1 cursor-pointer">
                      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${r.completed_today ? 'bg-brand-green border-brand-green' : 'border-[#2d5a42]'}`}>
                        {r.completed_today && <Check size={8} strokeWidth={3} className="text-brand-bg" />}
                      </div>
                      <span className="text-[10px] text-brand-green truncate">{r.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══ MODO EXPANDIDO ═══ */}
        {mode === 'expanded' && (
          <div className="grid grid-cols-[1fr_1fr_188px] gap-3">

            {/* GIOVANNA */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-brand-border">
                <div className="w-7 h-7 rounded-full bg-brand-green-bg flex items-center justify-center text-[10px] font-medium text-brand-green flex-shrink-0">
                  {(profile?.name ?? 'GI').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-medium">{profile?.name ?? 'Giovanna'}</div>
                  <div className="text-[10px] text-brand-subtle">home office</div>
                </div>
                <span className="ml-auto text-[10px]">
                  <span className="text-brand-green font-medium">{myDone.length}</span>
                  <span className="text-brand-faint"> / {myTasks.length} feitas</span>
                </span>
              </div>

              {myTasks.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-xs text-brand-faint mb-3">Nenhuma tarefa cadastrada</div>
                  <button onClick={() => setShowSuggestions(true)} className="text-xs text-brand-green border border-brand-green-border px-3 py-1.5 rounded-lg hover:bg-brand-green-bg transition-colors">
                    Ver sugestões de rotina
                  </button>
                </div>
              ) : (
                <>
                  {/* pendentes por categoria */}
                  {Object.entries(groupBy(myPending)).map(([cat, catTasks]) => (
                    <div key={cat} className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-medium text-brand-faint uppercase tracking-wider">{CATEGORY_LABELS[cat] ?? cat}</span>
                        <div className="flex-1 h-px bg-brand-surface2" />
                      </div>
                      {catTasks.map(t => <TaskRow key={t.id} task={t} showSwap />)}
                    </div>
                  ))}
                  {/* divisor concluídas */}
                  {myDone.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px bg-brand-surface2" />
                        <span className="text-[9px] text-brand-faint uppercase tracking-wider">concluídas</span>
                        <div className="flex-1 h-px bg-brand-surface2" />
                      </div>
                      {Object.entries(groupBy(myDone)).map(([cat, catTasks]) => (
                        <div key={cat} className="mb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-medium text-brand-faint uppercase tracking-wider">{CATEGORY_LABELS[cat] ?? cat}</span>
                            <div className="flex-1 h-px bg-brand-surface2" />
                          </div>
                          {catTasks.map(t => <TaskRow key={t.id} task={t} />)}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
              <div className="mt-3 pt-2.5 border-t border-brand-border flex justify-between text-[10px]">
                <span className="text-brand-faint">XP hoje</span>
                <span className="font-medium">+{myDone.reduce((s: number,t: any)=>s+t.xp_value,0)} XP</span>
                <span className="text-brand-faint">semana</span>
                <span className="font-medium">{totalXP} XP</span>
              </div>
            </div>

            {/* SABRINA */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-brand-border">
                <div className="w-7 h-7 rounded-full bg-brand-purple-bg flex items-center justify-center text-[10px] font-medium text-brand-purple flex-shrink-0">
                  {(partner?.name ?? 'SA').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-medium">{partner?.name ?? 'Sabrina'}</div>
                  <div className="text-[10px] text-brand-subtle">professora</div>
                </div>
                <span className="ml-auto text-[10px]">
                  <span className="text-brand-green font-medium">{pDone.length}</span>
                  <span className="text-brand-faint"> / {partnerTasks.length} feitas</span>
                </span>
              </div>

              {partnerTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-brand-faint">Sem tarefas atribuídas</div>
              ) : (
                <>
                  {Object.entries(groupBy(pPending)).map(([cat, catTasks]) => (
                    <div key={cat} className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-medium text-brand-faint uppercase tracking-wider">{CATEGORY_LABELS[cat] ?? cat}</span>
                        <div className="flex-1 h-px bg-brand-surface2" />
                      </div>
                      {catTasks.map(t => <TaskRow key={t.id} task={t} showSwap />)}
                    </div>
                  ))}
                  {pDone.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px bg-brand-surface2" />
                        <span className="text-[9px] text-brand-faint uppercase tracking-wider">concluídas</span>
                        <div className="flex-1 h-px bg-brand-surface2" />
                      </div>
                      {pDone.map(t => <TaskRow key={t.id} task={t} />)}
                    </>
                  )}
                </>
              )}
              <div className="mt-3 pt-2.5 border-t border-brand-border flex justify-between text-[10px]">
                <span className="text-brand-faint">XP hoje</span>
                <span className="font-medium">+{pDone.reduce((s: number,t: any)=>s+t.xp_value,0)} XP</span>
              </div>
            </div>

            {/* SIDEBAR */}
            <div className="space-y-2.5">
              {/* XP */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-1">XP do casal</div>
                <div className="text-2xl font-medium">{totalXP}</div>
                <div className="text-[10px] text-brand-subtle mb-2">/ {xpNext} · Nível {level.level}</div>
                <div className="bg-brand-surface2 rounded-full h-1 overflow-hidden mb-2">
                  <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: xpPct + '%' }} />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="bg-brand-surface2 rounded-lg p-2 text-center">
                    <div className="text-[9px] text-brand-faint truncate">{profile?.name ?? 'Giovanna'}</div>
                    <div className="text-xs font-medium">{myDone.reduce((s: number,t: any)=>s+t.xp_value,0)}</div>
                  </div>
                  <div className="bg-brand-surface2 rounded-lg p-2 text-center">
                    <div className="text-[9px] text-brand-faint truncate">{partner?.name ?? 'Sabrina'}</div>
                    <div className="text-xs font-medium">{pDone.reduce((s: number,t: any)=>s+t.xp_value,0)}</div>
                  </div>
                </div>
              </div>

              {/* Casa */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-1">Estado da casa</div>
                <div className="text-sm font-medium mb-0.5" style={{ color: chaos.color }}>{chaos.label}</div>
                <div className="text-[10px] text-brand-subtle mb-2">Caos: {chaosLevel}%</div>
                <div className="bg-brand-surface2 rounded-full h-1 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: chaosLevel + '%', background: chaos.color }} />
                </div>
              </div>

              {/* Cães */}
              <div
                className="bg-brand-green-bg border border-brand-green-border rounded-xl p-3 cursor-pointer"
                onClick={() => dogs.length === 0 && setShowPetModal(true)}
              >
                <div className="text-[9px] font-medium text-[#2d8a5a] uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1"><PawPrint size={10} /> Cães</span>
                  <button onClick={e => { e.stopPropagation(); setShowPetModal(true) }} className="text-[#2d8a5a] hover:text-brand-green">
                    <Plus size={12} />
                  </button>
                </div>
                {dogs.length === 0 ? (
                  <div className="text-[10px] text-brand-green opacity-60">Cadastrar pet →</div>
                ) : (
                  dogs.map((dog: any) => (
                    <div key={dog.id} className="mb-2">
                      <div className="text-[10px] font-medium text-brand-green mb-1.5">{dog.name} {dog.is_puppy ? '🐶' : '🐕'}</div>
                      {dog.routines.map((r: any) => (
                        <div key={r.id} onClick={e => { e.stopPropagation(); completeDogRoutine(r.id, dog.id) }}
                          className="flex items-center gap-2 py-1 border-b border-[#1a3a2a] last:border-0 cursor-pointer">
                          <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${r.completed_today ? 'bg-brand-green border-brand-green' : 'border-[#2d5a42]'}`}>
                            {r.completed_today && <Check size={9} strokeWidth={3} className="text-brand-bg" />}
                          </div>
                          <span className="text-[10px] text-brand-green flex-1 truncate">{r.title}</span>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* Streak */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
                <div className="text-[9px] font-medium text-brand-faint uppercase tracking-wider mb-2">Streak</div>
                <div className="flex gap-1">
                  {streakDays.map((d, i) => (
                    <div key={i} className={`flex-1 h-5 rounded-sm flex items-center justify-center text-[8px] font-medium ${streakDone[i] ? 'bg-brand-amber text-brand-bg' : i === todayIdx ? 'border-2 border-brand-amber text-brand-amber' : 'bg-brand-surface2 text-brand-faint'}`}>{d}</div>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <button onClick={() => setShowSuggestions(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-xs text-brand-subtle hover:text-brand-text hover:border-brand-green transition-colors interactive">
                <Sparkles size={13} className="text-brand-green" /> Sugestões de rotina
              </button>

              <button onClick={() => setShowEnergy(!showEnergy)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-xs text-brand-subtle hover:text-brand-text transition-colors interactive">
                <Zap size={13} /> Energia da semana
              </button>

              <button onClick={() => { toggleSurvivalMode(); fireToast(isSurvivalMode ? 'Modo normal ativado!' : 'Modo sobrevivência ativado.') }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs border transition-colors interactive ${isSurvivalMode ? 'bg-brand-green-bg border-brand-green text-brand-green' : 'bg-[#1a0c08] border-[#5a2010] text-brand-coral'}`}>
                <Shield size={13} />
                {isSurvivalMode ? 'Desativar modo sobrevivência' : 'Ativar modo sobrevivência'}
              </button>
            </div>

          </div>
        )}

        {/* FAB */}
        <button onClick={() => setShowTaskModal(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-brand-green rounded-full flex items-center justify-center shadow-xl interactive z-40 hover:scale-105 transition-transform">
          <Plus size={22} className="text-brand-bg" strokeWidth={2.5} />
        </button>

      </div>

      {/* MODAIS */}
      {(showTaskModal || editTask) && (
        <TaskModal onClose={() => { setShowTaskModal(false); setEditTask(null) }} editTask={editTask} />
      )}
      {showPetModal && (
        <PetModal onClose={() => { setShowPetModal(false); refreshAll() }} />
      )}
      {showSuggestions && (
        <SuggestionsModal onClose={() => { setShowSuggestions(false); refreshAll() }} />
      )}
    </div>
  )
}
