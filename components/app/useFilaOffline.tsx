'use client'
// Fila sem internet: o que foi feito sem conexão fica guardado e é enviado quando ela volta.
// Parte da base do app (components/app/useAppCore.tsx junta as partes na ordem).
import { useCallback, useEffect, useState, useRef } from 'react'
import type { Who } from '@/lib/types'
import { toNinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import { enqueue, flush as flushOutbox, newId, readOutbox, writeOutbox, type OutItem } from '@/lib/outbox'
import { isOfflineError } from '@/lib/offline'
import * as mdApi from '@/lib/services/meudia'
import type { AppBase } from './tipos'
import type { Avisos } from './useAvisos'
import type { Preferencias } from './usePreferencias'
import type { Navegacao } from './useNavegacao'
import type { Dados } from './useDados'

export function useFilaOffline(c:AppBase&Avisos&Preferencias&Navegacao&Dados){
  const {data,householdId,md,showError,showToast,today}=c
  // ── Fila sem internet ──
  const [outbox,setOutbox]=useState<OutItem[]>(()=>readOutbox(householdId))
  const flushing=useRef(false)
  const queue=(it:OutItem)=>setOutbox(l=>{const n=enqueue(l,it);writeOutbox(householdId,n);return n})
  const sendOutbox=useCallback(async()=>{
    const list=readOutbox(householdId)
    if(!list.length||flushing.current)return
    flushing.current=true
    try{
      const r=await flushOutbox(list,{
        task:async(id,date,by,done)=>{if(done)await api.completeTask(id,date,by);else await api.uncompleteTask(id,date)},
        dogs:async(ids,date,by,done)=>{if(done)await api.completeDogRoutines(ids,date,by);else await api.uncompleteDogRoutines(ids,date)},
        log:async it=>{try{await mdApi.addLog(householdId,it.who,it.date,it.logKind as any,it.value,it.data,it.logId)}catch(e:any){if(e?.code!=='23505'&&e?.original?.code!=='23505'&&!/duplicate|23505/i.test(String(e?.message)))throw e}},
        isOffline:isOfflineError,
      })
      writeOutbox(householdId,r.left);setOutbox(r.left)
      if(r.sent){showToast(`✓ ${r.sent} ação${r.sent>1?'ões':''} feita${r.sent>1?'s':''} sem internet ${r.sent>1?'foram enviadas':'foi enviada'}`);data.loadAll();md.reload()}
      if(r.rejected.length)showError(toNinhoError(r.rejected[0].error,`enviar "${r.rejected[0].item.title}" (feito sem internet)`))
    }finally{flushing.current=false}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[householdId])
  useEffect(()=>{
    sendOutbox()
    const on=()=>{sendOutbox()}
    window.addEventListener('online',on)
    const iv=setInterval(()=>{if(readOutbox(householdId).length)sendOutbox()},20000)
    return()=>{window.removeEventListener('online',on);clearInterval(iv)}
  },[sendOutbox,householdId])
  /** +1 copo, autocuidado, remédio: sem internet fica na fila (com id fixo para não duplicar). */
  const mdAdd=async(who:Who,k:any,v:number|null,d:Record<string,any>={},date?:string)=>{
    try{await md.add(who,k,v,d,date)}catch(e){
      if(!isOfflineError(e)||!['agua','autocuidado','remedio'].includes(k))throw e
      const logId=newId()
      md.setData(x=>({...x,logs:[...x.logs,{id:logId,who,date:today,kind:k,value:v,data:d}]}))
      queue({id:newId(),at:new Date().toISOString(),kind:'log',logId,who,date:today,logKind:k,value:v,data:d,title:k==='agua'?'água':k})
      showToast('📴 Sem internet: guardado. Envia quando a conexão voltar.')
    }
  }

  return {
    flushing,mdAdd,outbox,queue,sendOutbox,setOutbox,
  }
}

export type FilaOffline = ReturnType<typeof useFilaOffline>
