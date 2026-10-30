'use client'
// O dia de hoje: plano (tarefas e cães de hoje), energia, nível, XP e o que o Início mostra.
// Parte do estado do app (ver components/app/useNinhoApp.tsx, que junta as partes na ordem).
import { useEffect } from 'react'
import type { HItem, Who } from '@/lib/types'
import { ENERGY } from '@/lib/constants'
import { greeting, longDateLabel } from '@/lib/dates'
import { dueToday } from '@/lib/frequency'
import { busyWindows } from '@/lib/busy'
import { isLate, planToday } from '@/lib/today'
import { XPW, getChaosInfo, getLevel, levelProgress } from '@/lib/xp'
import { toNinhoError } from '@/lib/errors'
import { dogCare, nowSummary, routineNow, weekDays } from '@/lib/week'
import { routineOnDay, runProgress, type Routine } from '@/lib/rotinas'
import { setAppBadge } from '@/lib/badge'
import { mascotSay } from '@/lib/mascote'
import { firstName } from '@/components/AppModals'
import type { AppCore } from './useAppCore'

export function useDia(c:AppCore){
  const {ag,casa,cz,dogs,hour,me,names,now,nowHM,rot,routines,settings,setup,showAllToday,showError,streak,tasks,today,week,weekStart,xp}=c
  // ── DERIVED ───────────────────────────────────────────
  const focusMode=settings.survival||settings.energy==='low'
  // Mesma conta usada pela notificação da manhã (lib/today.ts)
  const busy=busyWindows(ag.events,today)
  const plan=planToday(tasks,dogs,today,{focus:focusMode&&!showAllToday,split:casa.split,busy,dogPlan:cz.dogPlan})
  const {dogTasks,homeTasks,dueList,todayTasks,dogItems,ownerOfItem,ownerOfTask,ownerOfRoutine}=plan
  const hItems:HItem[]=plan.items
  const hiddenCount=dueList.length-todayTasks.length
  const xpOfItem=(i:HItem)=>i.task?XPW[i.task.weight]:i.dog!.parts.length
  const allToday=[...dueList.map(t=>!!t.completed_today),...dogItems.map(d=>d.completed_today)]
  const doneToday=allToday.filter(Boolean).length
  const dayPct=allToday.length?Math.round(doneToday/allToday.length*100):0
  const dailyTasks=homeTasks.filter(t=>t.frequency==='daily')
  const chaos=dailyTasks.length?Math.max(0,Math.round(100-(dailyTasks.filter(t=>t.completed_today).length/dailyTasks.length)*100)):0
  const ci=getChaosInfo(chaos)
  const lv=getLevel(xp)
  const xpPct=levelProgress(xp)
  const puppies=dogs.filter(d=>d.is_puppy)
  const dogDaily=dogs.flatMap(d=>d.routines.filter(r=>dueToday(r,today)).map(r=>({r,dog:d})))
  const dogDone=dogDaily.filter(x=>x.r.completed_today).length
  const en=ENERGY[settings.energy]||ENERGY.medium
  const hello=greeting(hour)
  const dateLabel=longDateLabel(now)
  // Migration 019 aplicada? (as tarefas trazem a coluna priority)
  const casaOk=tasks.some(t=>'priority' in t)
  const periodOk=tasks.some(t=>'starts_on' in t)
  const pauseOk=tasks.some(t=>'paused_until' in t)
  const helpReq=tasks.filter(t=>t.help_by&&t.help_by!==me&&!t.completed_today)
  const countFor=(w:Who)=>{const all=hItems.filter(i=>ownerOfItem(i)===w);return{all:all.length,done:all.filter(i=>i.completed_today).length}}
  // Número no ícone do app: o que ainda falta para mim hoje
  const myLeft=me?(c=>c.all-c.done)(countFor(me)):0
  useEffect(()=>{if(me)setAppBadge(myLeft)},[me,myLeft])
  // Início: semana real, rotina do momento, resumo de agora, cuidados dos cães, desafio sugerido
  const weekInfo=weekDays(weekStart,today,{tasks,dogs,checkins:week.checkins,days:week.days,survivalNow:settings.survival})
  const rn=routineNow(routines.filter(r=>routineOnDay(r,today)),today,nowHM)
  const rnRun=(r:Routine|null)=>r?runProgress(r,rot.runs.find(x=>x.routine_id===r.id&&x.date===today),settings.survival):null
  const nowSum=nowSummary(hItems,me,ownerOfItem,nowHM)
  const care=dogCare(casa.maint,today)
  const challenge=(setup?.answers as any)?.challenge as {title:string,days:number,why:string}|undefined
  const itemTitle=(i:HItem)=>i.task?i.task.title:i.dog!.title
  /** O que o Nino (mascote) diz agora */
  const mascot=mascotSay({hour,total:allToday.length,done:doneToday,late:nowSum.late,chaos,survival:settings.survival,lowEnergy:settings.energy==='low',streak,level:lv.l,
    next:nowSum.next?itemTitle(nowSum.next):null,me:me?firstName(names[me]):null,
    dogsLate:Array.from(new Set(dogItems.filter(d=>(!me||d.owner===me)&&isLate(d,nowHM)).flatMap(d=>d.parts.filter(x=>!x.r.completed_today).map(x=>x.dog.name))))})
  async function saveCheckin(v:Parameters<typeof week.checkin>[2]){
    if(!me)return
    try{await week.checkin(today,me,v)}catch(e){showError(toNinhoError(e,'salvar check-in'));throw e}
  }

  return {
    allToday,busy,care,casaOk,challenge,chaos,ci,countFor,dailyTasks,dateLabel,dayPct,dogDaily,dogDone,dogItems,
    dogTasks,doneToday,dueList,en,focusMode,hItems,hello,helpReq,hiddenCount,homeTasks,itemTitle,lv,mascot,myLeft,
    nowSum,ownerOfItem,ownerOfRoutine,ownerOfTask,pauseOk,periodOk,plan,puppies,rn,rnRun,saveCheckin,todayTasks,
    weekInfo,xpOfItem,xpPct,
  }
}

export type Dia = ReturnType<typeof useDia>
