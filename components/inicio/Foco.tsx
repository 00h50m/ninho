'use client'
// Modo foco: em tela cheia, só o que é seu agora, com um ✓ grande em cada item.
import type { HItem } from '@/lib/types'
import { hhmm } from '@/lib/dates'
import { WHY_LABEL, type FocusItem } from '@/lib/foco'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyNino } from '@/components/ui/Empty'

export function FocusSheet({ list, rest, title, busy, onDone, onMenu, onClose }: {
  list: FocusItem[], rest: number, title: (i: HItem) => string, busy: (i: HItem) => boolean,
  onDone: (i: HItem) => void, onMenu: (i: HItem) => void, onClose: () => void,
}) {
  return (
    <Sheet size="lg" title="🎯 Foco" onClose={onClose} footer={<button className="btn btn-p" onClick={onClose}>Sair do foco</button>}>
      {list.length === 0
        ? <div className="empty"><EmptyNino icon="🎉" mood="festa"/>Nada urgente para você agora.{rest > 0 && <div className="row-s">Ainda há {rest} para hoje, sem pressa.</div>}</div>
        : <>
          <p className="row-s foco-sub">Só o que é seu agora. O resto do Início fica esperando.</p>
          <ul className="foco-l">
            {list.map(({ item, why }) => (
              <li key={item.id} className={`foco-i foco-${why}`}>
                <button className="foco-chk" disabled={busy(item)} onClick={() => onDone(item)} aria-label={`Concluir ${title(item)}`}>✓</button>
                <div className="foco-t">
                  <b>{title(item)}</b>
                  <span className="foco-why">{WHY_LABEL[why]}{item.scheduled_time ? ` · ${hhmm(item.scheduled_time)}` : ''}{item.dog ? ' · cães' : ''}</span>
                </div>
                {item.task && <button className="ib foco-m" onClick={() => onMenu(item)} aria-label={`Opções de ${title(item)}`}>⋯</button>}
              </li>
            ))}
          </ul>
          {rest > 0 && <p className="row-s">+{rest} no resto do dia</p>}
        </>}
    </Sheet>
  )
}
