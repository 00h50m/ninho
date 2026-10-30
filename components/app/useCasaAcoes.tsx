'use client'
// Casa: divisão, compras, manutenção e agenda.
// Parte do estado do app (ver components/app/useNinhoApp.tsx, que junta as partes na ordem).
import type { Task, Who } from '@/lib/types'
import { FEFF } from '@/lib/constants'
import { dueToday } from '@/lib/frequency'
import { type SplitMode } from '@/lib/split'
import * as casaApi from '@/lib/services/casa'
import type { MaintenanceItem } from '@/lib/maintenance'
import { XPW } from '@/lib/xp'
import { toNinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import * as agApi from '@/lib/services/agenda'
import { type HouseEvent } from '@/lib/agenda'
import { firstName } from '@/components/AppModals'
import type { AppCore } from './useAppCore'
import type { Dia } from './useDia'
import type { Tarefas } from './useTarefas'
import type { RotinasSprint } from './useRotinasSprint'
import type { CaesAcoes } from './useCaesAcoes'
import type { NosAcoes } from './useNosAcoes'

export function useCasaAcoes(c:AppCore&Dia&Tarefas&RotinasSprint&CaesAcoes&NosAcoes){
  const {ag,casa,closeModal,data,gS,homeTasks,householdId,me,names,sS,save,setSaving,setTasks,showError,showToast,tasks,today,toggleTask,withPending}=c
  // ── CASA: divisão, compras, manutenção ───────────────
  async function saveSplit(mode:SplitMode){
    if(mode===casa.split)return
    const prev=casa.split
    casa.setSplit(mode)
    await withPending(['split'],async()=>{
      try{await casaApi.saveSplitMode(householdId,mode);showToast(mode==='smart'?'Divisão inteligente ativada':'Rodízio fixo ativado')}
      catch(e){casa.setSplit(prev);showError(toNinhoError(e,'salvar modo de divisão'),()=>saveSplit(mode))}
    })
  }
  function saveMaint(d:casaApi.MaintenanceInput,id?:string){
    save(id?'atualizar manutenção':'criar manutenção',async()=>{await casaApi.saveMaintenance(householdId,d,id);await casa.reloadMaintenance()},id?'Manutenção atualizada!':`"${d.title}" criada!`)
  }
  function removeMaint(it:MaintenanceItem){
    if(!confirm(`Remover "${it.title}"? O histórico fica guardado.`))return
    save('remover manutenção',async()=>{await casaApi.archiveMaintenance(it.id);casa.setMaint(l=>l.filter(x=>x.id!==it.id))},'Manutenção removida')
  }
  function addMaintTemplates(rows:casaApi.MaintenanceInput[]){
    save('criar manutenções',async()=>{await casaApi.insertMaintenanceMany(householdId,rows);await casa.reloadMaintenance()},`${rows.length} manutenç${rows.length===1?'ão adicionada':'ões adicionadas'}!`)
  }
  // Compra finalizada: oferece marcar a tarefa de mercado pendente
  function onShoppingFinished(count:number){
    if(!count)return
    const t=tasks.find(x=>x.category==='shopping'&&!x.completed_today&&dueToday(x,today)&&/mercado|compra|feira/i.test(x.title))
    if(t&&confirm(`Marcar "${t.title}" como feita? (+${XPW[t.weight]} XP)`))toggleTask(t)
  }
  async function autoDistribute(){
    const active=homeTasks.filter(t=>t.frequency!=='once')
    if(!active.length){showToast('Adicione tarefas primeiro');return}
    if(!confirm('Distribuir define uma responsável fixa para cada tarefa (e tira todas do rodízio). Continuar?'))return
    let gS=0,sS=0
    const updates:Array<{id:string,assigned_to:Who}>=[]
    const assign=(t:Task,who:Who)=>{updates.push({id:t.id,assigned_to:who});const w=XPW[t.weight]*(FEFF[t.frequency]||1);if(who==='g')gS+=w;else sS+=w}
    active.filter(t=>t.essential&&t.category==='dogs').sort((a,b)=>(a.scheduled_time||'').localeCompare(b.scheduled_time||'')).forEach((t,i)=>assign(t,i%2===0?'g':'s'))
    active.filter(t=>t.weight==='heavy'&&!(t.essential&&t.category==='dogs')).forEach(t=>assign(t,gS<=sS?'g':'s'))
    active.filter(t=>t.frequency==='daily'&&!t.essential&&t.weight!=='heavy').forEach(t=>assign(t,gS*0.85<=sS?'g':'s'))
    active.filter(t=>!updates.find(u=>u.id===t.id)).forEach(t=>assign(t,gS<=sS?'g':'s'))
    await withPending(['distribute'],async()=>{
      try{
        await api.updateTasks(updates.filter(u=>u.assigned_to==='g').map(u=>u.id),{assigned_to:'g'})
        await api.updateTasks(updates.filter(u=>u.assigned_to==='s').map(u=>u.id),{assigned_to:'s'})
        const m=new Map(updates.map(u=>[u.id,u.assigned_to]))
        setTasks(ts=>ts.map(t=>m.has(t.id)?{...t,assigned_to:m.get(t.id)!}:t))
        showToast(`Distribuído — ${firstName(names.g)}: ${Math.round(gS)}pts · ${firstName(names.s)}: ${Math.round(sS)}pts`)
      }catch(e){
        showError(toNinhoError(e,'distribuir tarefas'),autoDistribute)
        data.reloadTasks().catch(()=>{})
      }
    })
  }
  // ── AGENDA DA CASA ──
  async function saveEvent(d:agApi.EventInput){setSaving(true)
    try{await agApi.saveEvent(householdId,me,d);closeModal();await ag.reload();showToast(d.id?'Salvo':d.kind==='vencimento'?'Vencimento anotado':'Evento na agenda')}
    catch(e){showError(toNinhoError(e,'salvar evento'))}finally{setSaving(false)}}
  async function eventDone(e:HouseEvent,done:boolean){
    try{await agApi.setEventDone(e.id,done);closeModal();await ag.reload();showToast(done?`✓ ${e.title}`:`${e.title} reaberto`,done?()=>{eventDone(e,false)}:undefined)}
    catch(err){showError(toNinhoError(err,'concluir evento'))}}
  async function billPaid(e:HouseEvent,paid:boolean){
    ag.setData(d=>({...d,events:d.events.map(x=>x.id===e.id?{...x,paid}:x)}))
    try{await agApi.setBillPaid(e.id,paid);showToast(paid?`${e.title}: pago`:`${e.title}: pendente`)}
    catch(err){await ag.reload();showError(toNinhoError(err,'marcar vencimento'))}}
  async function deleteEvent(e:HouseEvent){setSaving(true)
    try{await agApi.deleteEvent(e.id);closeModal();await ag.reload();showToast('Apagado')}catch(err){showError(toNinhoError(err,'apagar evento'))}finally{setSaving(false)}}
  async function saveSobrou(url:string|null){
    try{await agApi.saveSobrouUrl(householdId,url);await ag.reload();showToast(url?'Link do Sobrou! salvo':'Link do Sobrou! removido')}catch(err){showError(toNinhoError(err,'salvar link do Sobrou!'))}}

  return {
    addMaintTemplates,autoDistribute,billPaid,deleteEvent,eventDone,onShoppingFinished,removeMaint,saveEvent,
    saveMaint,saveSobrou,saveSplit,
  }
}

export type CasaAcoes = ReturnType<typeof useCasaAcoes>
