'use client'
// Aba Compras: lista compartilhada ao vivo. Uma adiciona ou risca, a outra vê na hora.
import { useMemo, useRef, useState } from 'react'
import type { Names, Who } from '@/lib/types'
import type { NinhoError } from '@/lib/errors'
import { toNinhoError } from '@/lib/errors'
import * as casa from '@/lib/services/casa'
import { SHOP_CATS, buyAgain, groupOpen, guessCategory, parseEntry, shoppingCounts, type ShoppingItem } from '@/lib/shopping'

const first = (n: string) => (n || '').split(' ')[0]

export function ShoppingTab({ householdId, me, names, items, history, state, error, setItems, onReload, requireMe, toast, fail, onFinished }: {
  householdId: string, me: Who | null, names: Names
  items: ShoppingItem[], history: ShoppingItem[], state: 'loading' | 'ready' | 'error', error: NinhoError | null
  setItems: (f: (l: ShoppingItem[]) => ShoppingItem[]) => void
  onReload: () => Promise<void>
  requireMe: () => Who | null
  toast: (msg: string, undo?: () => void) => void
  fail: (e: NinhoError, retry?: () => void) => void
  /** Compra finalizada: o app oferece marcar a tarefa de mercado. */
  onFinished: (count: number) => void
}) {
  const [text, setText] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const parsed = parseEntry(text)
  const guessed = parsed.title ? guessCategory(parsed.title) : 'outros'
  const chosenCat = cat ?? guessed
  const groups = useMemo(() => groupOpen(items), [items])
  const again = useMemo(() => buyAgain(history, items), [history, items])
  const c = shoppingCounts(items)

  const mark = (id: string, on: boolean) => setBusy(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n })

  async function add(title: string, qty: string | null, category: string) {
    const by = me ?? requireMe()
    if (!by) return
    const tmpId = 'tmp:' + Math.random().toString(36).slice(2)
    const exists = items.find(i => !i.done_at && i.title.trim().toLowerCase() === title.trim().toLowerCase())
    if (!exists) {
      setItems(l => [...l, { id: tmpId, household_id: householdId, title, qty, category, note: null, added_by: by, checked_at: null, checked_by: null, done_at: null, created_at: new Date().toISOString() }])
    }
    try {
      const r = await casa.addShoppingItem(householdId, title, qty, category, by)
      if (!r.created) toast(r.reopened ? `${title} voltou para a lista` : `${title} já está na lista`)
      await onReload()
    } catch (e) {
      setItems(l => l.filter(i => i.id !== tmpId))
      fail(toNinhoError(e, 'adicionar item'), () => add(title, qty, category))
    }
  }

  function submit() {
    const p = parseEntry(text)
    if (!p.title) return
    add(p.title, p.qty, chosenCat)
    setText(''); setCat(null)
    inputRef.current?.focus()
  }

  async function toggle(it: ShoppingItem) {
    if (it.id.startsWith('tmp:') || busy.has(it.id)) return
    const by = me ?? requireMe()
    if (!by) return
    const on = !it.checked_at
    const before = { checked_at: it.checked_at, checked_by: it.checked_by }
    mark(it.id, true)
    setItems(l => l.map(x => x.id === it.id ? { ...x, checked_at: on ? new Date().toISOString() : null, checked_by: on ? by : null } : x))
    try { await casa.setShoppingChecked(it.id, by, on) }
    catch (e) {
      setItems(l => l.map(x => x.id === it.id ? { ...x, ...before } : x))
      fail(toNinhoError(e, 'riscar item'), () => toggle(it))
    } finally { mark(it.id, false) }
  }

  async function remove(it: ShoppingItem) {
    if (it.id.startsWith('tmp:')) return
    setItems(l => l.filter(x => x.id !== it.id))
    try {
      await casa.removeShoppingItem(it.id)
      toast(`${it.title} removido`, () => { add(it.title, it.qty, it.category) })
    } catch (e) {
      setItems(l => [...l, it])
      fail(toNinhoError(e, 'remover item'), () => remove(it))
    }
  }

  async function finish() {
    if (!c.checked) return
    if (!confirm(`Finalizar a compra? ${c.checked} ite${c.checked === 1 ? 'm riscado sai' : 'ns riscados saem'} da lista${c.toBuy ? ` e ${c.toBuy} continua${c.toBuy === 1 ? '' : 'm'} para a próxima` : ''}.`)) return
    const checked = items.filter(i => i.checked_at && !i.done_at)
    setItems(l => l.filter(i => !i.checked_at))
    try {
      const ids = await casa.finishShopping(householdId)
      toast(`Compra finalizada · ${ids.length} ite${ids.length === 1 ? 'm' : 'ns'}`, async () => {
        try { await casa.reopenShopping(ids); await onReload(); toast('Itens de volta na lista') }
        catch (e) { fail(toNinhoError(e, 'desfazer finalizar compra')) }
      })
      await onReload()
      onFinished(ids.length)
    } catch (e) {
      setItems(l => [...l, ...checked.filter(x => !l.some(y => y.id === x.id))])
      fail(toNinhoError(e, 'finalizar compra'), finish)
    }
  }

  async function editQty(it: ShoppingItem) {
    const v = prompt(`Quantidade de ${it.title}`, it.qty || '')
    if (v === null) return
    const qty = v.trim().slice(0, 30) || null
    setItems(l => l.map(x => x.id === it.id ? { ...x, qty } : x))
    try { await casa.updateShoppingItem(it.id, { qty }) }
    catch (e) { setItems(l => l.map(x => x.id === it.id ? { ...x, qty: it.qty } : x)); fail(toNinhoError(e, 'atualizar item')) }
  }

  return (
    <div className="narrow">
      <div className="sh">
        <div><h2>Compras</h2><p>{c.open === 0 ? 'Lista vazia' : `${c.toBuy} para comprar${c.checked ? ` · ${c.checked} no carrinho` : ''}`} · ao vivo entre vocês</p></div>
      </div>

      {state === 'error' && <div className="card loaderr" role="alert">
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Não foi possível abrir a lista</div>
        <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 14 }}>{error?.userMessage}</div>
        <button className="btn btn-p" onClick={() => onReload()}>Tentar novamente</button>
      </div>}

      {state !== 'error' && <>
        <div className="shop-add">
          <input ref={inputRef} className="fi" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="Adicionar item (ex.: 2 kg arroz)" aria-label="Adicionar item" maxLength={90} enterKeyHint="done"/>
          <select className="fi shop-cat" value={chosenCat} onChange={e => setCat(e.target.value)} aria-label="Categoria">
            {SHOP_CATS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn btn-p" onClick={submit} disabled={!parsed.title} aria-label="Adicionar">+</button>
        </div>
        {text && parsed.qty && <div className="shop-hint">Quantidade: <b>{parsed.qty}</b> · {parsed.title}</div>}

        {again.length > 0 && <div className="shop-again">
          <div className="slbl">Comprar de novo</div>
          <div className="fchips" style={{ marginBottom: 14 }}>
            {again.map(a => <button key={a.title} className="fc" onClick={() => add(a.title, null, a.category)} title={`${a.count}× nas últimas compras`}>+ {a.title}</button>)}
          </div>
        </div>}

        {state === 'loading' && items.length === 0 ? <div className="loadscr" role="status"><span className="spin" aria-hidden="true"/>Carregando a lista…</div>
        : groups.length === 0 ? <div className="card empty"><span className="empty-icon">🛒</span>Nada na lista.<br/>Adicione acima ou toque em “Comprar de novo”.</div>
        : <div className="card">
          {groups.map(g => (
            <div key={g.cat}>
              <div className="cdiv">{g.label}<span className="n">{g.items.length}</span></div>
              {g.items.map(it => (
                <div key={it.id} className={`tr shop-row ${it.checked_at ? 'done' : ''}`}>
                  <button className={`chk ${busy.has(it.id) ? 'busy' : ''}`} onClick={() => toggle(it)} disabled={busy.has(it.id) || it.id.startsWith('tmp:')}
                    aria-label={it.checked_at ? `Desmarcar ${it.title}` : `Riscar ${it.title}`}>✓</button>
                  <div className="trb" onClick={() => toggle(it)}>
                    <div className="trt">{it.title}</div>
                    <div className="trm">
                      {it.checked_at ? <span className="tag-by">✓ {it.checked_by ? first(names[it.checked_by]) : 'riscado'}</span>
                        : it.added_by && <span className="tag-by">pedido por {first(names[it.added_by])}</span>}
                    </div>
                  </div>
                  <button className="bdg bdg-n qb" onClick={() => editQty(it)} aria-label={`Quantidade de ${it.title}`}>{it.qty || '+ qtd'}</button>
                  <button className="ib danger" onClick={() => remove(it)} aria-label={`Remover ${it.title}`}>✕</button>
                </div>
              ))}
            </div>
          ))}
        </div>}

        {c.checked > 0 && <button className="btn btn-p btn-w" style={{ marginTop: 14 }} onClick={finish}>✓ Finalizar compra ({c.checked} no carrinho)</button>}
        <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 12, textAlign: 'center' }}>
          Toque no item para riscar. “Finalizar compra” tira os riscados da lista e guarda para o “comprar de novo”.
        </div>
      </>}
    </div>
  )
}

