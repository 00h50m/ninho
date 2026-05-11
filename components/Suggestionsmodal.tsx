'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/AppContext'
import { X, Sparkles, Check } from 'lucide-react'
import { getXPForWeight } from '@/lib/utils'

const SUGGESTIONS: Record<string, Array<{title: string, weight: 'light'|'medium'|'heavy', frequency: string}>> = {
  'Cozinha': [
    { title: 'Louça diária',            weight: 'light',  frequency: 'daily'   },
    { title: 'Limpar bancada e fogão',  weight: 'light',  frequency: 'daily'   },
    { title: 'Lixo da cozinha',         weight: 'light',  frequency: 'daily'   },
    { title: 'Organizar geladeira',     weight: 'medium', frequency: 'weekly'  },
    { title: 'Limpar microondas',       weight: 'light',  frequency: 'weekly'  },
    { title: 'Limpar armários',         weight: 'medium', frequency: 'monthly' },
  ],
  'Banheiro': [
    { title: 'Limpar pia e espelho',    weight: 'light',  frequency: 'weekly'  },
    { title: 'Limpar vaso sanitário',   weight: 'medium', frequency: 'weekly'  },
    { title: 'Limpar box / chuveiro',   weight: 'medium', frequency: 'weekly'  },
    { title: 'Repor papel e sabonete',  weight: 'light',  frequency: 'weekly'  },
    { title: 'Lavar tapete',            weight: 'light',  frequency: 'weekly'  },
  ],
  'Casa geral': [
    { title: 'Varrer / aspirar',        weight: 'medium', frequency: 'weekly'  },
    { title: 'Passar pano no chão',     weight: 'medium', frequency: 'weekly'  },
    { title: 'Limpar espelhos',         weight: 'light',  frequency: 'weekly'  },
    { title: 'Reset da sala (noite)',   weight: 'light',  frequency: 'daily'   },
    { title: 'Faxina geral',            weight: 'heavy',  frequency: 'monthly' },
  ],
  'Lavanderia': [
    { title: 'Lavar roupa',             weight: 'medium', frequency: 'weekly'  },
    { title: 'Dobrar e guardar',        weight: 'medium', frequency: 'weekly'  },
    { title: 'Trocar roupa de cama',    weight: 'medium', frequency: 'weekly'  },
    { title: 'Lavar toalhas',           weight: 'medium', frequency: 'weekly'  },
  ],
  'Cães': [
    { title: 'Ração manhã',             weight: 'light',  frequency: 'daily'   },
    { title: 'Ração noite',             weight: 'light',  frequency: 'daily'   },
    { title: 'Água fresca',             weight: 'light',  frequency: 'daily'   },
    { title: 'Passeio manhã',           weight: 'medium', frequency: 'daily'   },
    { title: 'Passeio tarde',           weight: 'medium', frequency: 'daily'   },
    { title: 'Limpeza da área deles',   weight: 'light',  frequency: 'daily'   },
    { title: 'Banho',                   weight: 'heavy',  frequency: 'biweekly'},
    { title: 'Escovação',               weight: 'light',  frequency: 'weekly'  },
  ],
  'Compras': [
    { title: 'Mercado semanal',         weight: 'medium', frequency: 'weekly'  },
    { title: 'Repor produtos limpeza',  weight: 'light',  frequency: 'monthly' },
    { title: 'Repor ração dos cães',    weight: 'light',  frequency: 'monthly' },
  ],
}

const CATEGORY_MAP: Record<string, string> = {
  'Cozinha':    'kitchen',
  'Banheiro':   'bathroom',
  'Casa geral': 'general',
  'Lavanderia': 'laundry',
  'Cães':       'dogs',
  'Compras':    'shopping',
}

const WEIGHT_COLORS: Record<string, string> = {
  light:  'text-brand-green',
  medium: 'text-brand-amber',
  heavy:  'text-brand-coral',
}
const WEIGHT_PT: Record<string, string> = { light: 'leve', medium: 'médio', heavy: 'pesado' }
const FREQ_PT:   Record<string, string> = { daily: 'diária', weekly: 'semanal', biweekly: 'quinzenal', monthly: 'mensal' }

export function SuggestionsModal({ onClose }: { onClose: () => void }) {
  const { householdId, profile, partner } = useApp()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [assignTo, setAssignTo] = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(false)
  const [activeTab, setActiveTab] = useState(Object.keys(SUGGESTIONS)[0])

  const totalSelected = Object.values(selected).filter(Boolean).length

  function toggleItem(key: string) {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function selectAll(cat: string) {
    const updates: Record<string, boolean> = { ...selected }
    SUGGESTIONS[cat].forEach(t => { updates[`${cat}::${t.title}`] = true })
    setSelected(updates)
  }

  async function saveSelected() {
    if (!householdId) return
    setLoading(true)

    const toInsert: any[] = []
    Object.entries(selected).forEach(([key, on]) => {
      if (!on) return
      const [cat, title] = key.split('::')
      const task = SUGGESTIONS[cat]?.find(t => t.title === title)
      if (!task) return
      toInsert.push({
        household_id:   householdId,
        title:          task.title,
        category:       CATEGORY_MAP[cat] ?? 'general',
        weight:         task.weight,
        frequency:      task.frequency,
        assigned_to:    assignTo[key] || null,
        xp_value:       getXPForWeight(task.weight),
        active:         true,
      })
    })

    if (toInsert.length > 0) {
      await supabase.from('tasks').insert(toInsert)
    }

    setLoading(false)
    onClose()
  }

  const members = [
    { id: '',             label: 'Rodízio' },
    { id: profile?.id,   label: profile?.name  ?? 'Giovanna' },
    { id: partner?.id,   label: partner?.name  ?? 'Sabrina' },
  ].filter(m => m.id !== undefined) as { id: string, label: string }[]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-brand-surface rounded-2xl border border-brand-border animate-slide-up max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-brand-green" />
            <span className="text-sm font-medium">Sugestões de rotina</span>
          </div>
          <div className="flex items-center gap-3">
            {totalSelected > 0 && (
              <span className="text-[10px] text-brand-green bg-brand-green-bg px-2 py-0.5 rounded-full">
                {totalSelected} selecionadas
              </span>
            )}
            <button onClick={onClose} className="text-brand-subtle hover:text-brand-muted"><X size={18} /></button>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 flex-shrink-0 overflow-x-auto">
          {Object.keys(SUGGESTIONS).map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === cat ? 'bg-brand-green text-brand-bg' : 'text-brand-subtle hover:text-brand-muted'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* lista */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-brand-subtle">{SUGGESTIONS[activeTab].length} sugestões</span>
            <button onClick={() => selectAll(activeTab)} className="text-[10px] text-brand-green underline">
              Selecionar todas
            </button>
          </div>

          <div className="space-y-1.5">
            {SUGGESTIONS[activeTab].map(task => {
              const key = `${activeTab}::${task.title}`
              const on  = !!selected[key]
              return (
                <div key={task.title} className={`rounded-xl border transition-colors ${on ? 'bg-brand-green-bg border-brand-green' : 'bg-brand-surface2 border-brand-border'}`}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer" onClick={() => toggleItem(key)}>
                    <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 ${on ? 'bg-brand-green border-brand-green' : 'border-brand-border2'}`}>
                      {on && <Check size={9} strokeWidth={3} className="text-brand-bg" />}
                    </div>
                    <span className={`flex-1 text-xs font-medium ${on ? 'text-brand-green' : 'text-brand-muted'}`}>{task.title}</span>
                    <span className={`text-[9px] ${WEIGHT_COLORS[task.weight]}`}>{WEIGHT_PT[task.weight]}</span>
                    <span className="text-[9px] text-brand-faint">{FREQ_PT[task.frequency] ?? task.frequency}</span>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${on ? 'bg-brand-green text-brand-bg' : 'bg-brand-surface text-brand-faint'}`}>
                      +{getXPForWeight(task.weight)}
                    </span>
                  </div>

                  {/* responsável inline quando selecionado */}
                  {on && (
                    <div className="flex gap-1.5 px-3 pb-2.5">
                      {members.map(m => (
                        <button key={m.id} onClick={() => setAssignTo(prev => ({ ...prev, [key]: m.id }))}
                          className={`flex-1 py-1 rounded-lg text-[9px] border transition-colors ${(assignTo[key] ?? '') === m.id ? 'bg-brand-green text-brand-bg border-brand-green' : 'bg-brand-surface border-brand-border text-brand-subtle'}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* footer */}
        <div className="px-5 pb-5 pt-3 border-t border-brand-border flex-shrink-0">
          <button onClick={saveSelected} disabled={totalSelected === 0 || loading}
            className="w-full py-3 bg-brand-green text-brand-bg rounded-xl text-sm font-medium disabled:opacity-40 interactive">
            {loading ? 'Adicionando...' : `Adicionar ${totalSelected} tarefa${totalSelected !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
