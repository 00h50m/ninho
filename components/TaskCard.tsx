'use client'

import { useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { CATEGORY_LABELS, WEIGHT_LABELS } from '@/lib/utils'
import { Check, ArrowLeftRight, Clock } from 'lucide-react'

interface Task {
  id: string
  title: string
  category: string
  weight: 'light' | 'medium' | 'heavy'
  xp_value: number
  assigned_to: string | null
  scheduled_time: string | null
  completed_today: boolean
  completed_by_me: boolean
}

const WEIGHT_DOT: Record<string, string> = {
  light:  'bg-brand-green',
  medium: 'bg-brand-amber',
  heavy:  'bg-brand-coral',
}

interface Props {
  task: Task
  compact?: boolean
  showXP?: boolean
  onSwap?: () => void
}

export function TaskCard({ task, compact = false, showXP = true, onSwap }: Props) {
  const { completeTask, uncompleteTask } = useApp()
  const [animating, setAnimating] = useState(false)

  async function toggle() {
    if (animating) return
    setAnimating(true)
    if (task.completed_today && task.completed_by_me) {
      await uncompleteTask(task.id)
    } else if (!task.completed_today) {
      await completeTask(task.id)
    }
    setTimeout(() => setAnimating(false), 300)
  }

  const done = task.completed_today

  if (compact) {
    return (
      <div
        onClick={toggle}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer interactive transition-opacity ${done ? 'opacity-30' : 'bg-brand-surface2'}`}
      >
        <div className={`w-[17px] h-[17px] min-w-[17px] rounded-[4px] border flex items-center justify-center transition-all ${done ? 'bg-brand-green border-brand-green' : 'border-brand-border2'}`}>
          {done && <Check size={10} strokeWidth={3} className="text-brand-bg" />}
        </div>
        <span className={`flex-1 text-xs ${done ? 'line-through text-brand-subtle' : 'text-brand-muted'}`}>
          {task.title}
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${WEIGHT_DOT[task.weight]}`} />
        {task.scheduled_time && (
          <span className="text-[9px] text-brand-subtle flex items-center gap-0.5">
            <Clock size={9} />
            {task.scheduled_time.slice(0,5)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-all interactive ${done ? 'opacity-30' : 'hover:bg-brand-surface2'}`}
    >
      <div
        onClick={toggle}
        className={`w-4 h-4 min-w-[16px] rounded-[4px] border flex items-center justify-center transition-all ${done ? 'bg-brand-green border-brand-green' : 'border-brand-border2'}`}
      >
        {done && <Check size={9} strokeWidth={3} className="text-brand-bg" />}
      </div>

      <span
        onClick={toggle}
        className={`flex-1 text-xs ${done ? 'line-through text-brand-subtle' : 'text-brand-muted'}`}
      >
        {task.title}
      </span>

      <div className={`w-1.5 h-1.5 rounded-full ${WEIGHT_DOT[task.weight]}`} />

      {task.scheduled_time && (
        <span className="text-[9px] text-brand-subtle flex items-center gap-0.5">
          <Clock size={9} />
          {task.scheduled_time.slice(0,5)}
        </span>
      )}

      {showXP && (
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${done ? 'text-brand-green bg-brand-green-bg' : 'text-brand-faint bg-brand-surface2'}`}>
          +{task.xp_value}
        </span>
      )}

      {onSwap && !done && (
        <button
          onClick={e => { e.stopPropagation(); onSwap() }}
          className="text-brand-faint hover:text-brand-subtle p-0.5 rounded transition-colors"
          title="Oferecer troca"
        >
          <ArrowLeftRight size={11} />
        </button>
      )}
    </div>
  )
}
