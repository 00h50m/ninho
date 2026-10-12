'use client'
// Código de barras → alimento (base pública Open Food Facts). Lê o código pela foto quando o
// navegador sabe (Chrome/Android); senão, é só digitar os números de baixo das barras.
import { useRef, useState } from 'react'
import { lookupBarcode } from '@/lib/services/aiFiles'
import { validBarcode } from '@/lib/openFoodFacts'
import type { LabelRead } from '@/lib/foodLabel'

declare global { interface Window { BarcodeDetector?: any } }

export function BarcodeBox({ householdId, onFound, onClose }: { householdId: string, onFound: (l: LabelRead) => void, onClose: () => void }) {
  const [code, setCode] = useState('')
  const [st, setSt] = useState<{ s: 'busy' | 'reading' } | { s: 'err', msg: string } | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const canScan = typeof window !== 'undefined' && !!window.BarcodeDetector
  async function find(c: string) {
    const v = c.replace(/\D/g, '')
    if (!validBarcode(v)) { setSt({ s: 'err', msg: 'Confira os números: o código tem 8, 12, 13 ou 14 dígitos (os de baixo das barras).' }); return }
    setSt({ s: 'busy' })
    const r = await lookupBarcode(householdId, v)
    if (r.ok === false) { setSt({ s: 'err', msg: r.error }); return }
    setSt(null); onFound(r.data)
  }
  async function fromPhoto(f: File | undefined) {
    if (ref.current) ref.current.value = ''
    if (!f || !window.BarcodeDetector) return
    setSt({ s: 'reading' })
    try {
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
      const found = await det.detect(await createImageBitmap(f))
      const v = String(found?.[0]?.rawValue || '')
      if (!v) { setSt({ s: 'err', msg: 'Não achei o código na foto. Chegue mais perto, com o código reto, ou digite os números.' }); return }
      setCode(v); await find(v)
    } catch { setSt({ s: 'err', msg: 'Não consegui ler a foto. Digite os números de baixo das barras.' }) }
  }
  return (
    <div className="bc-box" role="group" aria-label="Código de barras">
      <div className="tk-add bc-row">
        <input className="fi mono" inputMode="numeric" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') find(code) }} placeholder="7891234567895" aria-label="Números do código de barras"/>
        <button className="btn btn-s" disabled={st?.s === 'busy' || !code.trim()} onClick={() => find(code)}>{st?.s === 'busy' ? 'Buscando…' : 'Buscar'}</button>
      </div>
      <div className="md-acts bc-acts">
        {canScan && <button className="btn btn-g" disabled={st?.s === 'reading'} onClick={() => ref.current?.click()}>{st?.s === 'reading' ? 'Lendo…' : '📷 Foto do código'}</button>}
        <button className="lnk-inline" onClick={onClose}>fechar</button>
        <input ref={ref} type="file" accept="image/*" capture="environment" hidden aria-label="Foto do código de barras" onChange={e => fromPhoto(e.target.files?.[0])}/>
      </div>
      {st?.s === 'err' && <p className="al-warn" role="alert">{st.msg}</p>}
      <small className="row-s">Base pública Open Food Facts: nem todo produto está lá, e os valores vêm de quem cadastrou. Confira com a embalagem antes de salvar.</small>
    </div>
  )
}
