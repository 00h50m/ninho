'use client'
// Enquanto a casa carrega: o formato da tela (cartões e linhas) em vez de só "Carregando…".
export function HomeSkeleton() {
  const line = (w: string, h = 12) => <span className="sk" style={{ width: w, height: h }}/>
  return (
    <div className="sk-wrap" role="status" aria-live="polite">
      <span className="sr-only">Carregando a casa…</span>
      <div aria-hidden="true">
        {line('55%', 22)}<div style={{ height: 8 }}/>{line('35%')}
        <div className="sk-row">{[0, 1, 2].map(i => <span key={i} className="sk sk-box"/>)}</div>
        {[0, 1].map(c => <div key={c} className="card sk-card">
          {line('40%', 14)}
          {[0, 1, 2, 3].map(i => <div key={i} className="sk-item"><span className="sk sk-chk"/>{line(`${70 - i * 9}%`)}</div>)}
        </div>)}
      </div>
    </div>
  )
}
