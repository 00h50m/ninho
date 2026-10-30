'use client'
// Nós: semana, nomes, reunião, desafios, linha do tempo e equilíbrio da carga.
// Parte do estado do app (ver components/app/useNinhoApp.tsx, que junta as partes na ordem).
import { useCallback, useEffect, useState } from 'react'
import type { Energy, Meeting, Task, Who } from '@/lib/types'
import { FEFF } from '@/lib/constants'
import { addDays, fmtDate } from '@/lib/dates'
import { pausedOn } from '@/lib/frequency'
import { forgotten, stuck } from '@/lib/retro'
import type { RetroAction } from '@/components/nos/Esquecidas'
import { isFixed } from '@/lib/rotation'
import { XPW } from '@/lib/xp'
import { toNinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import { sendMeetSummary } from '@/components/TelegramCard'
import { modeSettings } from '@/lib/reuniao'
import * as nosApi from '@/lib/services/nos'
import { meetingAgenda, progress as chProgress, timeline as nosTimeline, type Agreement, type AgendaSection, type Challenge } from '@/lib/nos'
import { waterOn, workoutsWeek, DEFAULT_SETTINGS as MD_DEFAULT } from '@/lib/meudia'
import { firstName } from '@/components/AppModals'
import type { AppCore } from './useAppCore'
import type { Dia } from './useDia'
import type { Tarefas } from './useTarefas'
import type { RotinasSprint } from './useRotinasSprint'
import type { CaesAcoes } from './useCaesAcoes'

export function useNosAcoes(c:AppCore&Dia&Tarefas&RotinasSprint&CaesAcoes){
  const {ag,closeModal,data,dogCareAgenda,dogs,historyData,homeTasks,householdId,loadHistory,md,me,names,nos,save,screen,setNames,setSettings,settings,showError,showToast,tasks,today,updateTaskFields,weekStart,withPending}=c
  // ── SEMANA, NOMES, REUNIÃO ────────────────────────────
  async function saveSettings(next:{energy:Energy,survival:boolean},okMsg:string){
    const prev=settings
    await withPending(['settings'],async()=>{
      setSettings(next)
      try{await api.saveWeeklySettings(householdId,weekStart,next);showToast(okMsg)}
      catch(e){setSettings(prev);showError(toNinhoError(e,'salvar ajustes da semana'),()=>saveSettings(next,okMsg))}
    })
  }
  function toggleSurvival(){const ns=!settings.survival;saveSettings({...settings,survival:ns},ns?'Modo sobrevivência ativado':'Modo normal ativado')}
  function setEnergy(e:Energy){closeModal();saveSettings({...settings,energy:e},'Energia atualizada!')}
  async function updateName(role:Who,val:string){
    const v=val.trim()
    if(!v||v===names[role])return
    const prev=names[role]
    setNames(n=>({...n,[role]:v}))
    try{await api.updateName(householdId,role,v);showToast('Nome atualizado!')}
    catch(e){setNames(n=>({...n,[role]:prev}));showError(toNinhoError(e,'atualizar nome'),()=>updateName(role,v))}
  }
  function saveMeeting(m:Meeting,agreements:Array<Agreement&{makeTask?:boolean}>|null,sendTg=false){
    let tgMsg=''
    save('salvar reunião',async()=>{
      await api.saveMeeting(householdId,weekStart,m)
      // o modo escolhido liga sozinho na segunda que vem
      const ms=modeSettings(m.next_mode);if(ms)await api.saveWeeklySettings(householdId,addDays(weekStart,7),ms)
      if(agreements){
        const out:Agreement[]=[]
        for(const a of agreements){
          let task_id=a.task_id
          if(a.makeTask&&!task_id)task_id=await nosApi.taskFromAgreement(householdId,a.text,a.who)
          out.push({text:a.text,who:a.who,task_id,done:a.done})
        }
        await nosApi.saveAgreements(householdId,weekStart,out)
        if(out.some(a=>a.task_id&&!agreements.find(x=>x.text===a.text)?.task_id))await data.reloadTasks()
        await nos.reload()
      }
      if(screen==='nos')await loadHistory()
      if(sendTg){const r=await sendMeetSummary(householdId,weekStart);tgMsg=r.error?`Reunião salva. O resumo não foi: ${r.error}`:`Reunião salva e resumo enviado no Telegram (${r.sent}) 📨`}
    },()=>tgMsg||'Reunião salva!')
  }
  async function toggleAgreement(weekStartOf:string,list:Agreement[],i:number){
    const next=list.map((a,j)=>j===i?{...a,done:!a.done}:a)
    try{await nosApi.saveAgreements(householdId,weekStartOf,next);await nos.reload()}catch(e){showError(toNinhoError(e,'atualizar combinado'))}
  }
  async function createChallenge(v:Parameters<typeof nosApi.createChallenge>[1]){
    try{await nosApi.createChallenge(householdId,v);await nos.reload();showToast('Desafio começou! 🤝')}catch(e){showError(toNinhoError(e,'criar desafio'));throw e}
  }
  async function markChallenge(c:Challenge,date:string,on:boolean){
    const prev=nos.facts
    nos.setData(d=>({...d,facts:{...d.facts,marks:on?[...d.facts.marks,{challenge_id:c.id,date,who:me}]:d.facts.marks.filter(m=>!(m.challenge_id===c.id&&m.date===date))}}))
    try{await nosApi.markChallenge(householdId,c.id,date,me,on);await nos.reload()}catch(e){nos.setData(d=>({...d,facts:prev}));showError(toNinhoError(e,'marcar desafio'))}
  }
  async function challengeStatus(c:Challenge,st:Challenge['status']){try{await nosApi.setChallengeStatus(c.id,st);await nos.reload()}catch(e){showError(toNinhoError(e,'atualizar desafio'))}}
  async function deleteChallenge(c:Challenge){try{await nosApi.deleteChallenge(c.id);await nos.reload()}catch(e){showError(toNinhoError(e,'apagar desafio'))}}
  // ── NÓS: dados derivados ──
  const inWk=(d:string)=>d>=weekStart&&d<=addDays(weekStart,6)
  const activeChs=nos.challenges.filter(c=>c.status==='active').map(c=>({c,p:chProgress(c,nos.facts,today)})).filter(x=>x.p.state==='active')
  const activeCh=activeChs[0]||null
  const thisMeetingRow=nos.meetings.find(m=>m.week_start===weekStart)
  const histMeeting=historyData?.find(h=>h.week===weekStart)?.meeting||null
  const thisMeeting=histMeeting||thisMeetingRow?{...(histMeeting||{}),agreements:thisMeetingRow?.agreements||[]} as any:null
  const lastMeeting=nos.meetings.find(m=>m.week_start===addDays(weekStart,-7))
  const sharedLines=(['g','s'] as Who[]).flatMap(w=>{
    const st=md.settings.find(x=>x.who===w)||MD_DEFAULT(w);const out:string[]=[]
    if(!md.available||!st.share)return out
    if(st.share.agua){let n=0;for(let i=0;i<7;i++){const d=addDays(weekStart,i);if(d<=today&&waterOn(md.logs,w,d)>=st.water_goal_ml)n++}out.push(`${firstName(names[w])}: água na meta ${n} dia${n===1?'':'s'}`)}
    if(st.share.treino){const k=workoutsWeek(md.logs,w,today);out.push(`${firstName(names[w])}: ${k.count} treino${k.count===1?'':'s'} (${k.minutes} min)`)}
    return out
  })
  const agenda:AgendaSection[]=nos.available?meetingAgenda({
    weekStart,today,completions:nos.completions,helpAsked:tasks.filter(t=>t.help_by).length,
    runs:nos.facts.runs,habitLogs:nos.facts.habitLogs,sprints:nos.sprints,checkins:nos.checkins,
    dogNext:dogCareAgenda.map(d=>({title:d.title,date:d.date})),
    events:ag.events.map((e:any)=>({title:e.title,date:e.date,kind:e.kind})),
    challenges:nos.challenges.filter(c=>c.status==='active'||(c.ended_at||'').slice(0,10)>=weekStart).map(c=>{const p=chProgress(c,nos.facts,today);return{title:c.title,hits:p.hits,goal:c.goal,state:c.status==='active'?p.state:c.status}}),
    shared:sharedLines,lastAgreements:lastMeeting?.agreements||[],
  },names):[]
  const onAlbumError=useCallback((e:unknown,c:string)=>showError(toNinhoError(e,c)),[])
  const nosTl=nos.available?nosTimeline({challenges:nos.challenges,meetings:nos.meetings,sprints:nos.sprints}):[]
  const together={done:nos.completions.filter(c=>inWk(c.date)).length,runs:nos.facts.runs.filter(r=>inWk(r.date)).length,habits:nos.facts.habitLogs.filter(h=>inWk(h.date)).length,sprints:nos.sprints.filter(x=>inWk(x.date)&&x.status==='done').length}
  // ── SEMANA: equilíbrio ────────────────────────────────
  const act=homeTasks.filter(t=>t.frequency!=='once')
  const allRoutines=dogs.flatMap(d=>d.routines)
  const dogLoad=allRoutines.reduce((s,r)=>s+(FEFF[r.frequency]||1),0)
  // Rodízio (e rotinas dos cães) conta metade para cada uma
  const loadOf=(_w:Who)=>act.reduce((s,t)=>{const v=XPW[t.weight]*(FEFF[t.frequency]||1);return s+(isFixed(t)?(t.assigned_to===_w?v:0):v/2)},0)+dogLoad/2
  const rotCount=act.filter(t=>!isFixed(t)).length
  const gS=loadOf('g'),sS=loadOf('s'),tot=gS+sS
  const gP=tot>0?Math.round((gS/tot)*100):50
  const balanced=Math.abs(gS-sS)<=3
  const maxHist=Math.max(1,...(historyData||[]).map(w=>w.completions))

  // ── RETROSPECTIVA QUE VIRA AJUSTE (reunião e sugestão do Início) ──
  const live=tasks.filter(t=>!pausedOn(t,today))
  const retroForgot=forgotten({tasks:live,today},28,5)
  async function adjustForgot(t:Task,a:RetroAction):Promise<string|null>{
    const patch:Partial<Task>=a.kind==='lighter'?a.patch:a.kind==='pause'?{paused_until:addDays(today,13)}:{assigned_to:a.to}
    const msg=a.kind==='lighter'?`${t.title}: ${a.label}`:a.kind==='pause'?`${t.title}: pausada até ${fmtDate(addDays(today,13))}`:`${t.title}: só ${firstName(names[a.to])}`
    if(!await updateTaskFields(t.id,patch))return null
    showToast(`✓ ${msg}`)
    return msg
  }
  // "Agora não" no cartão de sugestão: some por 4 semanas (neste aparelho)
  const [ajusteLater,setAjusteLater]=useState<Record<string,string>>({})
  useEffect(()=>{try{setAjusteLater(JSON.parse(localStorage.getItem('ninho.ajusteAgoraNao')||'{}')||{})}catch{}},[])
  const stuckTasks=stuck({tasks:live,today}).filter(t=>!(ajusteLater[t.id]>=today))
  function ajusteNotNow(t:Task){
    const n={...Object.fromEntries(Object.entries(ajusteLater).filter(([,d])=>d>=today)),[t.id]:addDays(today,27)}
    setAjusteLater(n);try{localStorage.setItem('ninho.ajusteAgoraNao',JSON.stringify(n))}catch{}
  }

  return {
    adjustForgot,ajusteNotNow,retroForgot,stuckTasks,
    act,activeCh,activeChs,agenda,allRoutines,balanced,challengeStatus,createChallenge,deleteChallenge,dogLoad,gP,
    gS,histMeeting,inWk,lastMeeting,loadOf,markChallenge,maxHist,nosTl,onAlbumError,rotCount,sS,saveMeeting,
    saveSettings,setEnergy,sharedLines,thisMeeting,thisMeetingRow,together,toggleAgreement,toggleSurvival,tot,
    updateName,
  }
}

export type NosAcoes = ReturnType<typeof useNosAcoes>
