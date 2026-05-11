'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/AppContext'
import { CATEGORIES, WEIGHT_LABELS, FREQUENCY_LABELS, getXPForWeight } from '@/lib/utils'
import { X } from 'lucide-react'

interface Props {
  onClose: () => void
  editTask?: any
}

export function TaskModal({ onClose, editTask }: Props) {
  const { householdId, profile, partner, refreshAll } = useApp()
  const [title,         setTitle]         = useState(editTask?.title ?? '')
  const [category,      setCategory]      = useState(editTask?.category ?? 'general')
  const [weight,        setWeight]        = useState<'light'|'medium'|'heavy'>(editTask?.weight ?? 'medium')
  const [frequency,     setFrequency]     = useState(editTask?.frequency ?? 'weekly')
  const [assignedTo,    setAssignedTo]    = useState(editTask?.assigned_to ?? '')
  const [scheduledTime, setScheduledTime] = useState(editTask?.scheduled_time ?? '')
  const [loading, setLoading] = useState(false)

  const xp = getXPForWeight(weight)

  async function save() {
    if (!householdId || !title.trim()) return
    setLoading(true)
    const payload = {
      household_id:   householdId,
      title:          title.trim(),
      category,
      weight,
      frequency,
      assigned_to:    assignedTo || null,
      scheduled_time: scheduledTime || null,
      xp_value:       xp,
      active:         true,
    }
    if (editTask) {
      await supabase.from('tasks').update(payload).eq('id', editTask.id)
    } else {
      await supabase.from('tasks').insert(payload)
    }
    await refreshAll()
    setLoading(false)
    onClose()
  }

  async function deleteTask() {
    if (!editTask) return
    await supabase.from('tasks').update({ active: false }).eq('id', editTask.id)
    await refreshAll()
    onClose()
  }

  const members = [
    { id: '', name: 'Qualquer uma (rodízio)' },
    ...(profile  ? [{ id: profile.id,  name: profile.name  }] : []),
    ...(partner  ? [{ id: partner.id,  name: partner.name  }] : []),
  ]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-brand-surface rounded-2xl border border-brand-border animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <span className="text-sm font-medium">{editTask ? 'Editar tarefa' : 'Nova tarefa'}</span>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-muted interactive">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* título */}
          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-1.5">Nome da tarefa</label>
            <input
              autoFocus
              type="text"
              placeholder="Ex: Limpar bancada da cozinha"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-brand-surface2 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-brand-text outline-none focus:border-brand-green transition-colors"
            />
          </div>

          {/* categoria */}
          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-1.5">Categoria</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`py-2 rounded-lg text-[10px] border transition-colors text-center ${category === cat.value ? 'bg-brand-green-bg border-brand-green text-brand-green' : 'bg-brand-surface2 border-brand-border text-brand-subtle'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* peso */}
          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-1.5">
              Peso / esforço
              <span className="ml-2 text-brand-faint normal-case font-normal">({xp} XP)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['light','medium','heavy'] as const).map(w => (
                <button
                  key={w}
                  onClick={() => setWeight(w)}
                  className={`py-2 rounded-lg text-xs border transition-colors ${weight === w
                    ? w === 'light'  ? 'bg-brand-green-bg border-brand-green text-brand-green'
                    : w === 'medium' ? 'bg-amber-900/30 border-brand-amber text-brand-amber'
                    :                  'bg-orange-900/30 border-brand-coral text-brand-coral'
                    : 'bg-brand-surface2 border-brand-border text-brand-subtle'
                  }`}
                >
                  {WEIGHT_LABELS[w]}
                </button>
              ))}
            </div>
          </div>

          {/* frequência */}
          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-1.5">Frequência</label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setFrequency(k)}
                  className={`py-2 rounded-lg text-[10px] border transition-colors ${frequency === k ? 'bg-brand-purple-bg border-brand-purple text-brand-purple' : 'bg-brand-surface2 border-brand-border text-brand-subtle'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* responsável */}
          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-1.5">Responsável padrão</label>
            <div className="grid grid-cols-1 gap-1.5">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => setAssignedTo(m.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs border transition-colors text-left ${assignedTo === m.id ? 'bg-brand-green-bg border-brand-green text-brand-green' : 'bg-brand-surface2 border-brand-border text-brand-subtle'}`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* horário */}
          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-1.5">
              Horário <span className="font-normal text-brand-faint">(opcional)</span>
            </label>
            <input
              type="time"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              className="bg-brand-surface2 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-brand-text outline-none focus:border-brand-green transition-colors"
            />
            {scheduledTime && (
              <button onClick={() => setScheduledTime('')} className="ml-2 text-xs text-brand-subtle">limpar</button>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="px-5 pb-5 flex gap-2">
          {editTask && (
            <button
              onClick={deleteTask}
              className="px-4 py-2.5 rounded-xl border border-red-900 text-red-400 text-xs hover:bg-red-950 transition-colors interactive"
            >
              Remover
            </button>
          )}
          <button
            onClick={save}
            disabled={!title.trim() || loading}
            className="flex-1 py-2.5 bg-brand-green text-brand-bg rounded-xl text-sm font-medium disabled:opacity-40 interactive"
          >
            {loading ? 'Salvando...' : editTask ? 'Salvar alterações' : 'Criar tarefa'}
          </button>
        </div>
      </div>
    </div>
  )
}
