'use client'
// Tarefas: concluir (e cães), editar, passar só hoje, pular, pausar, formulários, sugestões e estações.
// Parte do estado do app (ver components/app/useNinhoApp.tsx, que junta as partes na ordem).
import { useEffect, useState } from 'react'
import type { DogItem, DogRoutine, Task, Who } from '@/lib/types'
import { addDays, fmtDate } from '@/lib/dates'
import { isFixed } from '@/lib/rotation'
import { XPW } from '@/lib/xp'
import { completedByLabel } from '@/lib/completions'
import { toNinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import { canEarnOnTime, xpWithBonus } from '@/lib/gamification'
import { packTasks, type Pack, type PackItem } from '@/lib/estacoes'
import type { Sug } from '@/lib/sugestoes'
import { newId } from '@/lib/outbox'
import { isOfflineError } from '@/lib/offline'
import { firstName } from '@/components/AppModals'
import type { AppCore } from './useAppCore'
import type { Dia } from './useDia'

export function useTarefas(c:AppCore&Dia){
  const {casaView,closeModal,data,dogs,householdId,names,nowHM,patchRoutines,patchTask,plan,queue,refreshStats,requireMe,saving,screen,setSaving,setTasks,setToast,setXp,showError,showToast,tasks,today,withPending}=c
  // ── CONCLUSÕES (transacionais no banco) ───────────────
  async function toggleTask(t:Task){
    const by=requireMe();if(!by)return
    const was=!!t.completed_today
    const before:Partial<Task>={completed_today:t.completed_today,completed_by_today:t.completed_by_today,completion_id:t.completion_id}
    const delta=was?-XPW[t.weight]:xpWithBonus(XPW[t.weight],canEarnOnTime(t,nowHM))
    await withPending(['task:'+t.id],async()=>{
      // Atualização otimista: o check responde na hora e volta atrás se o banco recusar
      patchTask(t.id,{completed_today:!was,completed_by_today:was?null:by})
      setXp(v=>v+delta)
      try{
        if(was){
          await api.uncompleteTask(t.id,today)
          patchTask(t.id,{completion_id:null})
          showToast(`Desmarcada · ${t.title}`)
        }else{
          const r=await api.completeTask(t.id,today,by)
          patchTask(t.id,{completed_by_today:r.completed_by??null,completion_id:r.completion_id})
          data.rememberCompletion(r.completion_id,'task',t.id,today)
          const done={...t,completed_today:true,completed_by_today:r.completed_by,completion_id:r.completion_id}
          if(r.created)showToast(`+${r.xp} XP${r.on_time?' ⚡ no horário':''} · ${t.title}`,()=>{setToast(null);toggleTask(done)})
          else showToast(`Já estava concluída por ${completedByLabel(r.completed_by,names)}`)
        }
      }catch(e){
        if(isOfflineError(e)){queue({id:newId(),at:new Date().toISOString(),kind:'task',done:!was,taskId:t.id,date:today,by,title:t.title});showToast(`📴 Sem internet: ${was?'desmarcada':'feita'} no aparelho. Envia quando a conexão voltar.`);return}
        patchTask(t.id,before);setXp(v=>v-delta)
        showError(toNinhoError(e,'concluir tarefa'),()=>toggleTask(t))
      }finally{refreshStats()}
    })
  }
  // Marca (done=true) ou desmarca várias rotinas de uma vez — ex.: "Ração manhã" de todos os cães
  async function markDogs(rs:DogRoutine[],done:boolean,label?:string){
    const by=requireMe();if(!by)return
    const list=rs.filter(r=>!!r.completed_today!==done)
    if(!list.length)return
    const ids=list.map(r=>r.id)
    const before=new Map(list.map(r=>[r.id,{completed_today:r.completed_today,completed_by_today:r.completed_by_today,completion_id:r.completion_id}]))
    await withPending(ids.map(id=>'dog:'+id),async()=>{
      patchRoutines(new Map(ids.map(id=>[id,{completed_today:done,completed_by_today:done?by:null}])))
      setXp(v=>v+(done?ids.length:-ids.length))
      try{
        if(done){
          const r=await api.completeDogRoutines(ids,today,by)
          patchRoutines(new Map(r.completions.map(c=>[c.routine_id,{completed_by_today:c.completed_by??null,completion_id:c.completion_id}])))
          r.completions.forEach(c=>data.rememberCompletion(c.completion_id,'dog',c.routine_id,today))
          const doneList=list.map(x=>({...x,completed_today:true}))
          if(r.created>0)showToast(`+${r.xp_added} XP${r.on_time?' ⚡ no horário':''} · ${label||list[0].title}`,()=>{setToast(null);markDogs(doneList,false)})
          else showToast('Já estava concluída')
        }else{
          await api.uncompleteDogRoutines(ids,today)
          patchRoutines(new Map(ids.map(id=>[id,{completion_id:null}])))
          showToast(`Desmarcada · ${label||list[0].title}`)
        }
      }catch(e){
        if(isOfflineError(e)){queue({id:newId(),at:new Date().toISOString(),kind:'dogs',done,ids,date:today,by,title:label||list[0].title});showToast(`📴 Sem internet: ${label||list[0].title} guardado. Envia quando a conexão voltar.`);return}
        patchRoutines(before);setXp(v=>v-(done?ids.length:-ids.length))
        showError(toNinhoError(e,'concluir rotina'),()=>markDogs(rs,done,label))
      }finally{refreshStats()}
    })
  }
  function completeDog(r:DogRoutine){markDogs([r],!r.completed_today)}
  function toggleDogItem(it:DogItem){markDogs(it.parts.map(p=>p.r),!it.completed_today,it.title)}
  // ── TAREFAS ───────────────────────────────────────────
  // Alteração otimista de campos da tarefa, com rollback se o banco recusar
  async function updateTaskFields(id:string,patch:Partial<Task>):Promise<boolean>{
    const prev=tasks.find(t=>t.id===id);if(!prev)return false
    const back:Partial<Task>={};(Object.keys(patch) as Array<keyof Task>).forEach(k=>{(back as any)[k]=prev[k]})
    let ok=false
    await withPending(['edit:'+id],async()=>{
      patchTask(id,patch)
      try{await api.updateTask(id,patch);ok=true}
      catch(e){patchTask(id,back);showError(toNinhoError(e,'atualizar tarefa'),()=>updateTaskFields(id,patch))}
    })
    return ok
  }
  function quickUpdate(id:string,patch:Partial<Task>){updateTaskFields(id,patch)}
  function assignTask(id:string,to:string|null){updateTaskFields(id,{assigned_to:to})}
  async function swapTask(t:Task){
    const n:Who=plan.ownerOfTask(t)==='g'?'s':'g'
    const prev=t.assigned_to
    if(await updateTaskFields(t.id,{assigned_to:n}))
      showToast(`Passada para ${firstName(names[n])}${isFixed(t)?'':' (sai do rodízio)'}`,()=>{setToast(null);assignTask(t.id,prev)})
  }
  // ── PASSAR SÓ HOJE (036) ──────────────────────────────
  async function handoffToday(t:Task){
    const by=requireMe();if(!by)return
    const to:Who=plan.ownerOfTask(t)==='g'?'s':'g',before=t.handoff??null
    await withPending(['task:'+t.id],async()=>{
      patchTask(t.id,{handoff:{id:'tmp',date:today,to,by}})
      try{
        const r=await api.handoffTask(householdId,t.id,today,to,by)
        const handoff={id:r.id,date:r.date,to,by}
        patchTask(t.id,{handoff})
        showToast(`Só hoje com ${firstName(names[to])} · ${t.title}`,()=>{setToast(null);undoHandoff({...t,handoff})})
      }catch(e){patchTask(t.id,{handoff:before});showError(toNinhoError(e,'passar só hoje'),()=>handoffToday(t))}
    })
  }
  async function undoHandoff(t:Task){
    const h=t.handoff;if(!h||h.id==='tmp')return
    await withPending(['task:'+t.id],async()=>{
      patchTask(t.id,{handoff:null})
      try{await api.unhandoffTask(h.id);showToast(`De volta · ${t.title}`)}
      catch(e){patchTask(t.id,{handoff:h});showError(toNinhoError(e,'desfazer'),()=>undoHandoff({...t,handoff:h}))}
    })
  }
  // ── PULAR / DEIXAR PARA AMANHÃ ────────────────────────
  const SKIP_LABEL:Record<string,string>={daily:'Pular hoje',weekly:'Pular esta semana',biweekly:'Pular esta quinzena',monthly:'Pular este mês'}
  async function pauseTask(t:Task,kind:'snooze'|'skip'){
    const by=requireMe();if(!by)return
    // Pontual: "amanhã" muda a data dela
    if(t.frequency==='once'&&kind==='snooze'){
      const prev=t.due_date??null
      if(await updateTaskFields(t.id,{due_date:addDays(today,1)}))showToast(`Para amanhã · ${t.title}`,()=>{setToast(null);updateTaskFields(t.id,{due_date:prev})})
      return
    }
    const before=t.skip??null
    await withPending(['task:'+t.id],async()=>{
      patchTask(t.id,{skip:{id:'tmp',date:today,kind,by}})
      try{
        const r=await api.skipTask(householdId,t.id,today,kind,by)
        const skip={id:r.id,date:r.date,kind:r.kind,by}
        patchTask(t.id,{skip})
        showToast(kind==='skip'?`${SKIP_LABEL[t.frequency]||'Pulada'} · ${t.title}`:`Fica para amanhã · ${t.title}`,()=>{setToast(null);unpauseTask({...t,skip})})
      }catch(e){patchTask(t.id,{skip:before});showError(toNinhoError(e,kind==='skip'?'pular tarefa':'adiar tarefa'),()=>pauseTask(t,kind))}
    })
  }
  /** ⏸ Pausar até um dia (040): some de Hoje e da divisão; volta sozinha no dia seguinte. null = despausar. */
  async function pauseUntil(t:Task,until:string|null){
    const prev=t.paused_until??null
    if(await updateTaskFields(t.id,{paused_until:until}))showToast(until?`⏸ Pausada até ${fmtDate(until)} · ${t.title}`:`▶ De volta · ${t.title}`,()=>{setToast(null);updateTaskFields(t.id,{paused_until:prev})})
  }
  async function unpauseTask(t:Task){
    const s=t.skip;if(!s||s.id==='tmp')return
    await withPending(['task:'+t.id],async()=>{
      patchTask(t.id,{skip:null})
      try{await api.unskipTask(s.id);showToast(`De volta · ${t.title}`)}
      catch(e){patchTask(t.id,{skip:s});showError(toNinhoError(e,'desfazer pausa'),()=>unpauseTask({...t,skip:s}))}
    })
  }
  async function archiveTasks(list:Task[]){
    if(!confirm(`Arquivar ${list.length} tarefa${list.length!==1?'s':''} de cães? As rotinas da aba Cães continuam.`))return
    const ids=list.map(t=>t.id)
    await withPending(['archive'],async()=>{
      setTasks(p=>p.filter(x=>!ids.includes(x.id)))
      try{
        await api.updateTasks(ids,{active:false})
        showToast(`${list.length} tarefas arquivadas`,async()=>{
          setToast(null)
          try{await api.updateTasks(ids,{active:true});await data.reloadTasks();showToast('Tarefas de volta')}
          catch(e){showError(toNinhoError(e,'desfazer arquivamento'))}
        })
      }catch(e){
        setTasks(p=>[...p,...list.filter(t=>!p.some(x=>x.id===t.id))])
        showError(toNinhoError(e,'arquivar tarefas'),()=>archiveTasks(list))
      }
    })
  }
  // Operações de formulário: o modal só fecha se o banco aceitou
  async function save(context:string,fn:()=>Promise<void>,okMsg:string|(()=>string)){
    if(saving)return
    setSaving(true)
    try{await fn();closeModal();showToast(typeof okMsg==='function'?okMsg():okMsg)}
    catch(e){showError(toNinhoError(e,context))}
    finally{setSaving(false)}
  }
  function deleteTask(id:string){
    if(!confirm('Remover essa tarefa?'))return
    save('remover tarefa',async()=>{await api.updateTask(id,{active:false});setTasks(ts=>ts.filter(t=>t.id!==id))},'Tarefa removida')
  }
  async function askHelp(t:Task,ask:boolean){
    let who:Who|null=null
    if(ask){const w=requireMe();if(!w)return;who=w}
    const before={help_by:t.help_by??null,help_at:t.help_at??null}
    patchTask(t.id,{help_by:who,help_at:who?new Date().toISOString():null})
    try{await api.setTaskHelp(t.id,who);showToast(who?`Pedido de ajuda enviado · ${t.title}`:'Pedido de ajuda cancelado')}
    catch(e){patchTask(t.id,before);showError(toNinhoError(e,'pedir ajuda'))}}
  function saveTask(d:any,editId?:string){
    save(editId?'atualizar tarefa':'criar tarefa',async()=>{
      if(editId){await api.updateTask(editId,d);patchTask(editId,d)}
      else{await api.insertTasks(householdId,[d]);await data.reloadTasks()}
    },editId?'Tarefa atualizada!':`"${d.title}" criada!`)
  }
  /** Casa › Sugestões: tarefas arquivadas para trazer de volta. */
  const [archived,setArchived]=useState<Array<{id:string,title:string,frequency:string,assigned_to:string|null,weekdays?:number[]|null}>>([])
  useEffect(()=>{if(screen==='casa'&&casaView==='sugestoes')api.loadArchivedTasks(householdId).then(setArchived).catch(()=>{})},[screen,casaView,householdId,tasks.length])
  async function restoreTask(t:{id:string,title:string}){
    try{await api.restoreTask(t.id);await data.reloadTasks();setArchived(a=>a.filter(x=>x.id!==t.id));showToast(`↩ "${t.title}" de volta na rotina`)}
    catch(e){showError(toNinhoError(e,'trazer tarefa de volta'));throw e}
  }
  /** Casa › Sugestões: tarefa entra alternando; a de pet vira rotina de cada cão. */
  async function addSuggestion(sg:Sug){
    try{
      if(sg.kind==='pet'){
        for(const d of dogs)if(!d.routines.some(r=>r.title===sg.t))await api.upsertRoutine(householdId,d.id,{title:sg.t,frequency:sg.f,scheduled_time:null})
        await data.reloadDogs();showToast(`🐾 "${sg.t}" nas rotinas dos cães · alternando`)
      }else{
        await api.insertTasks(householdId,[{title:sg.t,category:sg.cat,weight:sg.w as any,frequency:sg.f,assigned_to:null,scheduled_time:null,essential:false}])
        await data.reloadTasks();showToast(`"${sg.t}" adicionada · alternando`)
      }
    }catch(e){showError(toNinhoError(e,'adicionar sugestão'));throw e}
  }
  /** Checklist de estação: as que repetem com período, as de uma vez como pontual no início. */
  async function addPack(p:Pack,items:PackItem[],from:string,to:string){
    try{await api.insertTasks(householdId,packTasks(items,from,to) as any);await data.reloadTasks();showToast(`${p.icon} ${items.length} tarefa${items.length===1?'':'s'} de ${p.label.toLowerCase()} · ${fmtDate(from)} a ${fmtDate(to)}`)}
    catch(e){showError(toNinhoError(e,'adicionar checklist'));throw e}
  }

  return {
    SKIP_LABEL,addPack,addSuggestion,archiveTasks,archived,askHelp,assignTask,completeDog,deleteTask,handoffToday,
    markDogs,pauseTask,pauseUntil,quickUpdate,restoreTask,save,saveTask,setArchived,swapTask,toggleDogItem,
    toggleTask,undoHandoff,unpauseTask,updateTaskFields,
  }
}

export type Tarefas = ReturnType<typeof useTarefas>
