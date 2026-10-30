'use client'
// O que chega de fora e o que abre sozinho: organizar o dia, configuração inicial, conquistas novas, links das notificações e a busca.
// Parte da base do app (components/app/useAppCore.tsx junta as partes na ordem).
import { useEffect, useState, useRef } from 'react'
import type { Who } from '@/lib/types'
import * as casaApi from '@/lib/services/casa'
import { useMaintActions } from '@/components/casa/Maintenance'
import { logError, toNinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import { evaluate, newlyUnlocked, TIER_NAMES, type AchievementState } from '@/lib/gamification'
import * as setupApi from '@/lib/services/onboarding'
import { shouldAutoOpen } from '@/lib/onboarding'
import * as agApi from '@/lib/services/agenda'
import type { SearchHit } from '@/lib/search'
import { toEvent, toTask, type DayItem } from '@/lib/organizar'
import { guessCategory } from '@/lib/shopping'
import type { AppBase } from './tipos'
import type { Avisos } from './useAvisos'
import type { Preferencias } from './usePreferencias'
import type { Navegacao } from './useNavegacao'
import type { Dados } from './useDados'
import type { FilaOffline } from './useFilaOffline'

export function useEntradas(c:AppBase&Avisos&Preferencias&Navegacao&Dados&FilaOffline){
  const {ag,casa,data,game,goCasa,goMd,householdId,md,mdAdd,me,now,openModal,refreshStats,requireMe,setAguaPop,setAskOpen,setCasaView,setNosView,setRotView,setSetup,setSprintOpen,setTab,setWantCup,setWantSprint,showError,showToast,sp,tasks,toastRef,today,wantCup,wantSprint}=c
  /** Cria o que o "Organizar meu dia" montou: tarefas avulsas, agenda e compras. */
  async function createDay(items:DayItem[]){
    try{
      const tasksIn=items.filter(i=>i.kind==='tarefa'),evs=items.filter(i=>i.kind==='compromisso'),buys=items.filter(i=>i.kind==='compra')
      if(tasksIn.length)await api.insertTasks(householdId,tasksIn.map(toTask) as any)
      for(const e of evs)await agApi.saveEvent(householdId,me,toEvent(e))
      for(const c of buys)await casaApi.addShoppingItem(householdId,c.title,null,guessCategory(c.title),me)
      await Promise.all([data.reloadTasks(),evs.length?ag.reload():null,buys.length?casa.reloadShopping():null])
      showToast(`🗓️ ${items.length} item(ns) no seu dia`)
    }catch(e){showError(toNinhoError(e,'organizar o dia'));throw e}
  }
  const [onb,setOnb]=useState<null|'open'|'redo'>(null)
  async function loadSetup(auto:boolean){
    if(!me)return
    try{
      const st=await setupApi.loadSetup(householdId,me)
      setSetup(st)
      if(auto&&shouldAutoOpen(st))setOnb('open')
    }catch(e){logError('carregar configuração',e)}
  }
  useEffect(()=>{if(data.status==='ready'&&me)loadSetup(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data.status==='ready',me,householdId])
  const maintActions=useMaintActions({today,me,requireMe:()=>requireMe(),setItems:casa.setMaint,reload:casa.reloadMaintenance,onXp:()=>refreshStats(),toast:(m,u)=>showToast(m,u),fail:(e,r)=>showError(e,r)})
  // Nova conquista de quem usa o aparelho: avisa quando sobe de nível nesta sessão
  const lastAch=useRef<{who:Who,list:AchievementState[]}|null>(null)
  useEffect(()=>{
    if(!me||data.status!=='ready')return
    const now=evaluate(game.stats[me])
    if(lastAch.current?.who===me){
      const up=newlyUnlocked(lastAch.current.list,now)[0]
      // não cobre o "Desfazer" que acabou de aparecer
      if(up)setTimeout(()=>showToast(`🏅 Nova conquista: ${up.def.name} (${TIER_NAMES[up.tier-1]})`),toastRef.current?.undo?4600:0)
    }
    lastAch.current={who:me,list:now}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[game.stats,me,data.status])
  useEffect(()=>{
    if(typeof window==='undefined')return
    const u=new URL(window.location.href),ir=u.searchParams.get('ir')
    if(!ir)return
    u.searchParams.delete('ir');window.history.replaceState(null,'',u.pathname+(u.search||'')+u.hash)
    switch(ir){
      case 'meudia':goMd('hoje');break
      case 'pergunta':setAskOpen(true);break
      case 'hoje':setTab('inicio');setTimeout(()=>document.getElementById('minhas')?.scrollIntoView({behavior:'smooth',block:'start'}),900);break
      case 'compras':setTab('casa');setCasaView('compras');break
      case 'tarefa':setTab('casa');setCasaView('tarefas');setTimeout(()=>openModal('task',null),300);break
      case 'agua':setAguaPop(p=>p+1);break
      case 'copo':setWantCup(true);break
      case 'refeicao':goMd('comida','refeicao');break
      case 'cardapio':goMd('comida','cardapio');break
      case 'rotulo':goMd('comida','rotulo');break
      case 'alimentacao':goMd('comida','plano');break
      case 'rotinas':setTab('rotinas');setRotView('rotinas');break
      case 'caes':setTab('caes');break
      case 'agenda':setTab('casa');setCasaView('agenda');break
      case 'faxinao':setTab('casa');setCasaView('faxinao');break
      case 'desafios':setTab('nos');setNosView('desafios');break
      case 'presentes':setTab('nos');setNosView('presentes');break
      case 'album':setTab('nos');setNosView('album');break
      case 'nos':setTab('nos');setNosView('semana');break
      case 'sprint':setTab('inicio');setWantSprint(true);break
      case 'checkin':setTab('inicio');setTimeout(()=>document.getElementById('checkin')?.scrollIntoView({behavior:'smooth',block:'center'}),900);break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  useEffect(()=>{
    if(!wantCup||!md.available||!me)return
    setWantCup(false)
    const cup=md.settings.find(x=>x.who===me)?.cup_ml||250
    mdAdd(me,'agua',cup).then(()=>{showToast(`💧 +${cup} ml`);setAguaPop(p=>p+1)}).catch(e=>showError(toNinhoError(e,'registrar água')))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[wantCup,md.available,me])
  function pickSearch(h:SearchHit){
    switch(h.kind){
      case 'tarefa':{const t=tasks.find((x:any)=>x.id===h.id);if(t)openModal('task',t);break}
      case 'compra':goCasa('compras');break
      case 'agenda':{const e=(ag.events||[]).find((x:any)=>x.id===h.id);setTab('casa');setCasaView('agenda');if(e)openModal('event',{event:e,kind:e.kind});break}
      case 'rotina':setTab('rotinas');setRotView('rotinas');break
      case 'cao':setTab('caes');break
      case 'alimento':goMd('comida','rotulo');break
      case 'salva':goMd('comida','refeicao');break
    }
  }
  useEffect(()=>{if(wantSprint&&sp.available){setWantSprint(false);if(sp.active)setSprintOpen(true)}},[wantSprint,sp.available,sp.active])

  return {
    createDay,lastAch,loadSetup,maintActions,onb,pickSearch,setOnb,
  }
}

export type Entradas = ReturnType<typeof useEntradas>
