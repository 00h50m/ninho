'use client'
// Rotinas com passos, hábitos e o Sprint do Ninho.
// Parte do estado do app (ver components/app/useNinhoApp.tsx, que junta as partes na ordem).
import { useState } from 'react'
import { toNinhoError } from '@/lib/errors'
import { turnBy } from '@/lib/rotation'
import * as rotApi from '@/lib/services/rotinas'
import { type Habit, type Routine } from '@/lib/rotinas'
import { TEMPLATES } from '@/lib/onboarding'
import * as spApi from '@/lib/services/sprint'
import { type SprintStart } from '@/components/sprint/SprintPanel'
import { type Sprint } from '@/lib/sprint'
import type { AppCore } from './useAppCore'
import type { Dia } from './useDia'
import type { Tarefas } from './useTarefas'

export function useRotinasSprint(c:AppCore&Dia&Tarefas){
  const {closeModal,householdId,me,plan,refreshStats,requireMe,rot,setSaving,setSpBusy,settings,showError,showToast,sp,today}=c
  // ── ROTINAS E HÁBITOS ──
  const routineTurn=(r:Routine)=>turnBy('routine:'+r.id,'daily',today,plan.slots)
  function stepRoutine(r:Routine,stepId:string,done:boolean){const w=requireMe();if(!w)return
    rot.checkStep(r.id,stepId,w,done,settings.survival).catch(e=>showError(toNinhoError(e,done?'marcar passo':'desmarcar passo')))}
  function finishRoutine(r:Routine,done:boolean){const w=requireMe();if(!w)return
    const ids=routineSteps(r).map(x=>x.id)
    rot.finish(r.id,w,done,settings.survival,ids).then(()=>showToast(done?`✓ ${r.title} concluída`:`${r.title} reaberta`)).catch(e=>showError(toNinhoError(e,done?'concluir rotina':'reabrir rotina')))}
  const routineSteps=(r:Routine)=>{const all=r.routine_steps;if(!settings.survival)return all;const red=all.filter(x=>x.survival);return red.length?red:all}
  async function saveRoutineDraft(d:rotApi.RoutineDraft){setSaving(true)
    try{await rotApi.saveRoutine(householdId,me,d);closeModal();await rot.reload();showToast(d.id?'Rotina salva':'Rotina criada')}
    catch(e){showError(toNinhoError(e,'salvar rotina'))}finally{setSaving(false)}}
  async function saveRoutineTemplate(d:rotApi.RoutineDraft){setSaving(true)
    try{await rotApi.saveAsTemplate(householdId,me,d);await rot.reload();showToast(`“${d.title.trim()}” salvo em Modelos`)}
    catch(e){showError(toNinhoError(e,'salvar modelo'))}finally{setSaving(false)}}
  async function addHouseTemplate(t:rotApi.HouseTemplate){setTplBusy(t.id)
    try{await rotApi.saveRoutine(householdId,me,rotApi.draftFromTemplate(t));await rot.reload();showToast(`${t.title} adicionada`)}
    catch(e){showError(toNinhoError(e,'adicionar modelo'))}finally{setTplBusy(null)}}
  async function deleteHouseTemplate(t:rotApi.HouseTemplate){
    try{await rotApi.deleteTemplate(t.id);await rot.reload();showToast(`Modelo “${t.title}” apagado`)}
    catch(e){showError(toNinhoError(e,'apagar modelo'))}}
  async function archiveRoutine(r:Routine){setSaving(true)
    try{await rotApi.archiveRoutine(r.id);closeModal();await rot.reload();showToast(`${r.title} arquivada (o histórico fica guardado)`)}
    catch(e){showError(toNinhoError(e,'arquivar rotina'))}finally{setSaving(false)}}
  const [tplBusy,setTplBusy]=useState<string|null>(null)
  async function addRoutineTemplate(key:string){const t=TEMPLATES.find(x=>x.key===key);if(!t)return;setTplBusy(key)
    try{const r=await rotApi.addTemplate(householdId,me,t,false);await rot.reload();showToast(r.created?`${t.title} adicionada`:`${t.title} já existe`)}
    catch(e){showError(toNinhoError(e,'adicionar modelo'))}finally{setTplBusy(null)}}
  async function saveHabitDraft(d:rotApi.HabitDraft){setSaving(true)
    try{await rotApi.saveHabit(householdId,me,d);closeModal();await rot.reload();showToast(d.id?'Hábito salvo':'Hábito criado')}
    catch(e){showError(toNinhoError(e,'salvar hábito'))}finally{setSaving(false)}}
  async function archiveHabit(h:Habit){setSaving(true)
    try{await rotApi.archiveHabit(h.id);closeModal();await rot.reload();showToast(`${h.title}: abandonado (o histórico fica guardado)`)}
    catch(e){showError(toNinhoError(e,'abandonar hábito'))}finally{setSaving(false)}}
  function toggleHabit(h:Habit,done:boolean){const w=requireMe();if(!w)return
    rot.logHabit(h.id,w,done).catch(e=>showError(toNinhoError(e,'registrar hábito')))}
  // ── SPRINT DO NINHO ──
  async function startSprint(v:SprintStart){const w=requireMe();if(!w)return;setSpBusy(true)
    try{await spApi.startSprint(householdId,{...v,started_by:w,date:today});await sp.reload()}
    catch(e:any){if(e?.code==='23505'){showToast('Já tem um sprint em andamento');await sp.reload()}else showError(toNinhoError(e,'iniciar sprint'))}
    finally{setSpBusy(false)}}
  async function pauseSprint(pause:boolean,extra=0){if(!sp.active)return;setSpBusy(true)
    try{await spApi.pauseSprint(sp.active.id,pause,extra);await sp.reload()}catch(e){showError(toNinhoError(e,pause?'pausar sprint':'continuar sprint'))}finally{setSpBusy(false)}}
  async function finishSprint(cancel:boolean):Promise<Sprint|null>{if(!sp.active)return null;const id=sp.active.id;setSpBusy(true)
    try{await spApi.finishSprint(id,cancel);const d=await spApi.loadSprints(householdId);sp.setData(d);refreshStats()
      if(cancel){showToast('Sprint cancelado');return null}
      return d.recent.find(x=>x.id===id)||null}
    catch(e){showError(toNinhoError(e,cancel?'cancelar sprint':'encerrar sprint'));return null}finally{setSpBusy(false)}}
  async function setSprintTasks(ids:string[]){if(!sp.active)return
    try{await spApi.updateSprintTasks(sp.active.id,ids);await sp.reload()}catch(e){showError(toNinhoError(e,'atualizar tarefas do sprint'))}}

  return {
    addHouseTemplate,addRoutineTemplate,archiveHabit,archiveRoutine,deleteHouseTemplate,finishRoutine,finishSprint,
    pauseSprint,routineSteps,routineTurn,saveHabitDraft,saveRoutineDraft,saveRoutineTemplate,setSprintTasks,
    setTplBusy,startSprint,stepRoutine,toggleHabit,tplBusy,
  }
}

export type RotinasSprint = ReturnType<typeof useRotinasSprint>
