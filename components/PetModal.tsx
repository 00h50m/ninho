'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/AppContext'
import { X, PawPrint } from 'lucide-react'

const DOG_ROUTINES_TEMPLATE = [
  { title: 'Ração manhã', frequency: 'daily', scheduled_time: '07:00' },
  { title: 'Água fresca', frequency: 'daily', scheduled_time: null },
  { title: 'Passeio manhã', frequency: 'daily', scheduled_time: '08:00' },
  { title: 'Ração noite', frequency: 'daily', scheduled_time: '18:00' },
  { title: 'Passeio tarde', frequency: 'daily', scheduled_time: '17:30' },
  { title: 'Escovação / higiene', frequency: 'weekly', scheduled_time: null },
  { title: 'Banho', frequency: 'weekly', scheduled_time: null },
  { title: 'Enriquecimento ambiental', frequency: 'daily', scheduled_time: null },
]

const PUPPY_EXTRAS = [
  { title: 'Saída xixi (manhã)', frequency: 'daily', scheduled_time: '07:30' },
  { title: 'Saída xixi (tarde)', frequency: 'daily', scheduled_time: '14:00' },
  { title: 'Saída xixi (noite)', frequency: 'daily', scheduled_time: '21:00' },
  { title: 'Treino básico', frequency: 'daily', scheduled_time: null },
  { title: 'Socialização', frequency: 'daily', scheduled_time: null },
]

export function PetModal({ onClose }: { onClose: () => void }) {
  const { householdId, profile, partner } = useApp()
  const [name, setName]         = useState('')
  const [breed, setBreed]       = useState('')
  const [isPuppy, setIsPuppy]   = useState(false)
  const [selectedRoutines, setSelectedRoutines] = useState<string[]>(
    DOG_ROUTINES_TEMPLATE.map(r => r.title)
  )
  const [loading, setLoading]   = useState(false)

  const allRoutines = isPuppy
    ? [...DOG_ROUTINES_TEMPLATE, ...PUPPY_EXTRAS]
    : DOG_ROUTINES_TEMPLATE

  function toggleRoutine(title: string) {
    setSelectedRoutines(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    )
  }

  async function save() {
    if (!householdId || !name.trim()) return
    setLoading(true)

    const { data: dog } = await supabase
      .from('dogs')
      .insert({ household_id: householdId, name: name.trim(), breed: breed.trim() || null, is_puppy: isPuppy, active: true })
      .select()
      .single()

    if (dog) {
      const routines = allRoutines
        .filter(r => selectedRoutines.includes(r.title))
        .map(r => ({
          dog_id: dog.id,
          household_id: householdId,
          title: r.title,
          frequency: r.frequency,
          scheduled_time: r.scheduled_time,
          active: true,
        }))
      await supabase.from('dog_routines').insert(routines)
    }

    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-brand-surface rounded-2xl border border-brand-border animate-slide-up max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <PawPrint size={16} className="text-brand-green" />
            <span className="text-sm font-medium">Cadastrar pet</span>
          </div>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-muted"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-1.5">Nome do pet</label>
            <input autoFocus type="text" placeholder="Ex: Luna, Bob, Thor..."
              value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-brand-surface2 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-brand-text outline-none focus:border-brand-green transition-colors" />
          </div>

          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-1.5">Raça <span className="font-normal text-brand-faint">(opcional)</span></label>
            <input type="text" placeholder="Ex: Golden Retriever, SRD..."
              value={breed} onChange={e => setBreed(e.target.value)}
              className="w-full bg-brand-surface2 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-brand-text outline-none focus:border-brand-green transition-colors" />
          </div>

          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-2">Perfil</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setIsPuppy(false)}
                className={`py-3 rounded-xl text-xs border transition-colors ${!isPuppy ? 'bg-brand-green-bg border-brand-green text-brand-green' : 'bg-brand-surface2 border-brand-border text-brand-subtle'}`}>
                🐕 Adulto / jovem
              </button>
              <button onClick={() => setIsPuppy(true)}
                className={`py-3 rounded-xl text-xs border transition-colors ${isPuppy ? 'bg-amber-900/30 border-brand-amber text-brand-amber' : 'bg-brand-surface2 border-brand-border text-brand-subtle'}`}>
                🐶 Filhote
              </button>
            </div>
            {isPuppy && (
              <div className="mt-2 text-[10px] text-brand-amber bg-amber-900/20 border border-brand-amber/30 rounded-lg px-3 py-2">
                Rotinas extras de filhote incluídas automaticamente — saídas frequentes, treino e socialização.
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-medium text-brand-subtle uppercase tracking-wider block mb-2">
              Rotinas diárias <span className="font-normal text-brand-faint">— marque as que quer ativar</span>
            </label>
            <div className="space-y-1.5">
              {allRoutines.map(r => (
                <div key={r.title}
                  onClick={() => toggleRoutine(r.title)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${selectedRoutines.includes(r.title) ? 'bg-brand-green-bg border-brand-green' : 'bg-brand-surface2 border-brand-border hover:border-brand-border2'}`}>
                  <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all ${selectedRoutines.includes(r.title) ? 'bg-brand-green border-brand-green' : 'border-brand-border2'}`}>
                    {selectedRoutines.includes(r.title) && <span className="text-brand-bg text-[10px]">✓</span>}
                  </div>
                  <span className={`flex-1 text-xs ${selectedRoutines.includes(r.title) ? 'text-brand-green' : 'text-brand-muted'}`}>{r.title}</span>
                  {r.frequency === 'weekly' && <span className="text-[9px] text-brand-faint bg-brand-surface px-1.5 py-0.5 rounded">semanal</span>}
                  {r.scheduled_time && <span className="text-[9px] text-brand-faint">{r.scheduled_time.slice(0,5)}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-brand-border flex-shrink-0">
          <button onClick={save} disabled={!name.trim() || loading}
            className="w-full py-3 bg-brand-green text-brand-bg rounded-xl text-sm font-medium disabled:opacity-40 interactive">
            {loading ? 'Salvando...' : `Adicionar ${name.trim() || 'pet'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
