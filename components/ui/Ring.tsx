'use client'
// Anel de progresso (tarefas do dia por pessoa, rotinas por cão)
export function Ring({pct,color,label}:{pct:number,color:string,label:string}){
  const s=46,r=19,c=2*Math.PI*r
  return(
    <div className="ring" aria-label={`${pct}% concluído`}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <circle cx={s/2} cy={s/2} r={r} fill="none" stroke="var(--sf3)" strokeWidth="4"/>
        <circle cx={s/2} cy={s/2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-pct/100)} style={{transition:'stroke-dashoffset .5s ease'}}/>
      </svg>
      <span>{label}</span>
    </div>
  )
}
