'use client'
import type { Names, Who } from '@/lib/types'
import { ROLE } from '@/lib/constants'
import { Sheet } from '@/components/ui/Sheet'

/**
 * "Quem está usando este aparelho?" — sem login.
 * Na primeira vez é obrigatório (sem botão de fechar); em Ajustes dá para trocar.
 */
export function DeviceIdentityModal({names,current,required,onPick,onClose}:{names:Names,current:Who|null,required:boolean,onPick:(w:Who)=>void,onClose:()=>void}){
  return(
    <Sheet size="sm" title="Quem está usando este aparelho?" onClose={onClose} dismissable={!required}>
      <div style={{fontSize:13,color:'var(--sub)',marginBottom:14,lineHeight:1.5}}>
        Fica salvo só neste aparelho. Serve para registrar quem concluiu cada tarefa. Dá para trocar depois em Ajustes.
      </div>
      <div className="btng" style={{gap:8}}>
        {(['g','s'] as Who[]).map(w=>(
          <button key={w} className={`sbtn who ${current===w?'on':''}`} onClick={()=>onPick(w)} aria-pressed={current===w}>
            <span className={`av av-${w}`} style={{width:36,height:36,fontSize:12}}>{(names[w]||'??').slice(0,2).toUpperCase()}</span>
            <span style={{textAlign:'left'}}>{names[w]}<small>{ROLE[w]}</small></span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
