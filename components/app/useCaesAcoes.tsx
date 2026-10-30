'use client'
// Cães: cadastro, rotinas, saúde, perfil, filhote e ração.
// Parte do estado do app (ver components/app/useNinhoApp.tsx, que junta as partes na ordem).
import type { Dog, DogRoutine } from '@/lib/types'
import { fmtDate } from '@/lib/dates'
import * as casaApi from '@/lib/services/casa'
import { toNinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import * as cApi from '@/lib/services/caes'
import { kindInfo, newBag as newBagStock, upcomingCare, type AccidentRow, type HealthRecord } from '@/lib/caes'
import type { AppCore } from './useAppCore'
import type { Dia } from './useDia'
import type { Tarefas } from './useTarefas'
import type { RotinasSprint } from './useRotinasSprint'

export function useCaesAcoes(c:AppCore&Dia&Tarefas&RotinasSprint){
  const {casa,closeModal,cz,data,dogs,householdId,me,routines,save,setAccidents,setDogs,setSaving,showError,showToast,today,withPending}=c
  // ── CÃES ──────────────────────────────────────────────
  function savePet(d:any,routines:any[]){
    save('cadastrar pet',async()=>{
      try{await api.insertDog(householdId,d,routines)}finally{await data.reloadDogs().catch(()=>{})}
    },`${d.name} cadastrado(a)!`)
  }
  function updateDog(id:string,d:any){
    save('atualizar pet',async()=>{await api.updateDog(id,d);setDogs(p=>p.map(x=>x.id===id?{...x,...d}:x))},'Pet atualizado!')
  }
  function removeDog(d:Dog){
    if(!confirm(`Remover ${d.name} e as rotinas dele(a)?`))return
    save('remover pet',async()=>{await api.updateDog(d.id,{active:false});setDogs(p=>p.filter(x=>x.id!==d.id))},`${d.name} removido(a)`)
  }
  function saveRoutine(dogId:string,d:any,id?:string){
    save(id?'atualizar rotina':'criar rotina',async()=>{await api.upsertRoutine(householdId,dogId,d,id);await data.reloadDogs()},id?'Rotina atualizada!':'Rotina criada!')
  }
  function removeRoutine(r:DogRoutine){
    if(!confirm(`Remover a rotina "${r.title}"?`))return
    save('remover rotina',async()=>{await api.setRoutineActive(r.id,false);await data.reloadDogs()},'Rotina removida')
  }
  async function addAccident(dogId:string,location:string){
    await withPending(['acc:'+dogId],async()=>{
      try{const row=await api.insertAccident(householdId,dogId,location,today);setAccidents(a=>[row,...a.filter(x=>x.id!==row.id)]);cz.reload();showToast('Acidente registrado')}
      catch(e){showError(toNinhoError(e,'registrar acidente'),()=>addAccident(dogId,location))}
    })
  }
  // ── CÃES: SAÚDE, PERFIL, FILHOTE ──
  const dogName=(id:string)=>dogs.find(d=>d.id===id)?.name||''
  const healthSoon=cz.available?upcomingCare(cz.records,today,60).filter(r=>dogs.some(d=>d.id===r.dog_id)):[]
  const dogCareAgenda=healthSoon.map(r=>({id:r.id,title:`${dogName(r.dog_id)}: ${r.title}`,date:r.next_date!,icon:kindInfo(r.kind)[1]}))
  async function saveHealth(d:cApi.HealthInput){setSaving(true)
    try{await cApi.saveHealth(householdId,me,d);closeModal();await cz.reload();showToast(d.id?'Cuidado atualizado':`${kindInfo(d.kind)[2]} registrado(a) · ${dogName(d.dog_id)}`)}
    catch(e){showError(toNinhoError(e,'registrar cuidado'))}finally{setSaving(false)}}
  async function deleteHealth(r:HealthRecord){if(!confirm(`Apagar o registro "${r.title}" de ${fmtDate(r.date)}?`))return;setSaving(true)
    try{await cApi.deleteHealth(r.id);closeModal();await cz.reload();showToast('Registro apagado')}catch(e){showError(toNinhoError(e,'apagar cuidado'))}finally{setSaving(false)}}
  async function buyFood(dog:Dog){
    try{const r=await casaApi.addShoppingItem(householdId,`Ração ${dog.food_brand||dog.name}`.trim(),null,'pets',me);await casa.reloadShopping();showToast(r.created?'Ração na lista de compras':'A ração já está na lista')}
    catch(e){showError(toNinhoError(e,'adicionar à lista'))}}
  /** "Comprei saco novo": estoque = saco + o que sobrou, a partir de hoje. */
  function newBag(dog:Dog,kg:number){
    const d=newBagStock(dog,kg,today)
    save('atualizar ração',async()=>{await api.updateDog(dog.id,d);setDogs(p=>p.map(x=>x.id===dog.id?{...x,...d}:x))},`Ração da ${dog.name} renovada 🍖`)}
  async function fixAccident(a:AccidentRow,patch:{location:string,occurred_at:string,date:string,notes:string|null}){
    const p:any={...patch};if(!cz.available)delete p.notes
    try{await cApi.updateAccident(a.id,p);await cz.reload();data.reloadAccidents?.();showToast('Registro corrigido')}catch(e){showError(toNinhoError(e,'corrigir acidente'))}}
  async function removeAccident(a:AccidentRow){
    try{await cApi.deleteAccident(a.id);await cz.reload();data.reloadAccidents?.();showToast('Registro apagado')}catch(e){showError(toNinhoError(e,'apagar acidente'))}}

  return {
    addAccident,buyFood,deleteHealth,dogCareAgenda,dogName,fixAccident,healthSoon,newBag,removeAccident,removeDog,
    removeRoutine,saveHealth,savePet,saveRoutine,updateDog,
  }
}

export type CaesAcoes = ReturnType<typeof useCaesAcoes>
