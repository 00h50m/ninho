'use client'
// Moldura do app: menu lateral (desktop), menu inferior (celular) e ações rápidas.
// As áreas e telas ficam em lib/nav.ts.
import type { ReactNode } from 'react'
import { Sheet } from '@/components/ui/Sheet'

import { MODULES, moduleOf, type ScreenId } from '@/lib/nav'
export { MODULES, moduleOf, legacyScreen } from '@/lib/nav'
export type { ModuleId, ScreenId, CasaView } from '@/lib/nav'

// ── Ícones (traço simples, herdam a cor do texto) ─────────────────────────
const P: Record<string, ReactNode> = {
  inicio: <><path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/></>,
  rotinas: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/></>,
  casa: <><path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/><path d="M9 11h.01M15 11h.01"/></>,
  caes: <><circle cx="7" cy="8" r="1.8"/><circle cx="12" cy="5.5" r="1.8"/><circle cx="17" cy="8" r="1.8"/><path d="M12 11c-3 0-5.5 3.2-5.5 5.6 0 1.8 1.3 2.9 3 2.9 1.1 0 1.6-.6 2.5-.6s1.4.6 2.5.6c1.7 0 3-1.1 3-2.9C17.5 14.2 15 11 12 11Z"/></>,
  nos: <><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  ajustes: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
  tarefa: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/></>,
  compra: <><path d="M5 7h14l-1.2 10.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9Z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/></>,
  ferramenta: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.6-.6-.6-2.6Z"/></>,
  reuniao: <><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></>,
  energia: <><path d="M13 3 5 14h6l-1 7 8-11h-6Z"/></>,
  busca: <><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></>,
  sprint: <><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M10 2.5h4M19 6l-1.5 1.5"/></>,
  escudo: <><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z"/></>,
}

export function Icon({ name, size = 22 }: { name: string, size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  )
}

export function SideNav({ current, onGo, onQuick, profile }: {
  current: ScreenId, onGo: (s: ScreenId) => void, onQuick: () => void
  profile: { initials: string, name: string, sub: string, cls: string }
}) {
  const active = moduleOf(current)
  return (
    <aside className="snav" aria-label="Navegação principal">
      <button className="snav-logo" onClick={() => onGo('inicio')} aria-label="Ninho, ir para o Início">Ni<span>nho</span></button>
      <button className="snav-quick" onClick={onQuick}><Icon name="plus" size={18}/>Ação rápida</button>
      <nav className="snav-list">
        {MODULES.map(m => (
          <button key={m.id} className={`snav-i ${active === m.id ? 'on' : ''}`} onClick={() => onGo(m.id)} aria-current={active === m.id ? 'page' : undefined}>
            <Icon name={m.id}/><span><b>{m.label}</b><small>{m.hint}</small></span>
          </button>
        ))}
      </nav>
      <button className={`snav-prof ${current === 'ajustes' ? 'on' : ''}`} onClick={() => onGo('ajustes')} aria-current={current === 'ajustes' ? 'page' : undefined} aria-label={`Perfil e ajustes de ${profile.name}`}>
        <span className={`av ${profile.cls}`}>{profile.initials}</span>
        <span className="snav-prof-t"><b>{profile.name}</b><small>{profile.sub}</small></span>
        <Icon name="ajustes" size={18}/>
      </button>
    </aside>
  )
}

export function BottomNav({ current, onGo }: { current: ScreenId, onGo: (s: ScreenId) => void }) {
  const active = moduleOf(current)
  return (
    <nav className="bnav" aria-label="Navegação principal">
      {MODULES.map(m => (
        <button key={m.id} className={`bnb ${active === m.id ? 'on' : ''}`} onClick={() => onGo(m.id)} aria-current={active === m.id ? 'page' : undefined}>
          <span className="ic"><Icon name={m.id}/></span>{m.label}
        </button>
      ))}
    </nav>
  )
}

export interface QuickAction { id: string, icon: string, label: string, sub: string, run: () => void }

export function QuickActionsSheet({ actions, onClose }: { actions: QuickAction[], onClose: () => void }) {
  return (
    <Sheet size="sm" title="Ação rápida" onClose={onClose}>
      <div className="qa-grid">
        {actions.map(a => (
          <button key={a.id} className="qa" onClick={() => { onClose(); a.run() }}>
            <span className="qa-ic"><Icon name={a.icon} size={20}/></span>
            <span className="qa-t"><b>{a.label}</b><small>{a.sub}</small></span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** Abas internas de uma área (ex.: Casa › Tarefas | Compras | Manutenção). */
export function SubTabs<T extends string>({ value, options, onChange, label }: { value: T, options: Array<[T, string, number?]>, onChange: (v: T) => void, label: string }) {
  return (
    <div className="subtabs" role="tablist" aria-label={label}>
      {options.map(([v, l, n]) => (
        <button key={v} role="tab" aria-selected={value === v} className={`subtab ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>
          {l}{!!n && <span className="subtab-n">{n}</span>}
        </button>
      ))}
    </div>
  )
}
