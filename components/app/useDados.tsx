'use client'
// Os dados da casa: relógio, quem está usando, tarefas, cães, Meu dia, rotinas, agenda, Nós, sprint e histórico.
// Parte da base do app (components/app/useAppCore.tsx junta as partes na ordem).
import { useEffect, useState, useRef } from 'react'
import type { DogRoutine, HistoryWeek, Task, Who } from '@/lib/types'
import { addDays } from '@/lib/dates'
import { useCasa } from '@/hooks/useCasa'
import { logError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import { useHomeClock } from '@/hooks/useHomeClock'
import { useDeviceIdentity } from '@/hooks/useDeviceIdentity'
import { useNinhoData } from '@/hooks/useNinhoData'
import * as setupApi from '@/lib/services/onboarding'
import { useDays } from '@/hooks/useDays'
import { markSurvivalDay } from '@/lib/services/days'
import { useRotinas } from '@/hooks/useRotinas'
import { useSprint } from '@/hooks/useSprint'
import { useAgenda } from '@/hooks/useAgenda'
import { useCasaExtra } from '@/hooks/useCasaExtra'
import { useCaes } from '@/hooks/useCaes'
import { useMeuDia } from '@/hooks/useMeuDia'
import { useNos } from '@/hooks/useNos'
import { useFaxinao } from '@/hooks/useFaxinao'
import type { AppBase } from './tipos'
import type { Avisos } from './useAvisos'
import type { Preferencias } from './usePreferencias'
import type { Navegacao } from './useNavegacao'

export function useDados(c:AppBase&Avisos&Preferencias&Navegacao){
  const {account,householdId,openModal,screen,setPerson,showError}=c
  const [historyData,setHistoryData]=useState<HistoryWeek[]|null>(null)
  const [historyError,setHistoryError]=useState(false)
  const {now,today,nowHM,hour,weekStart,todayIndex}=useHomeClock()
  const device=useDeviceIdentity()
  // Com login, quem fez = a conta; sem login (versão antiga), a escolha do aparelho
  const me=account?.who??device.who
  const data=useNinhoData(householdId,today,weekStart,e=>showError(e))
  const {tasks,setTasks,dogs,setDogs,settings,setSettings,xp,setXp,streak,names,setNames,accidents,setAccidents,game}=data
  const casa=useCasa(householdId,today)
  // Check-ins e dias da semana (migration 015)
  const week=useDays(householdId,weekStart)
  const survivalMarked=useRef('')
  useEffect(()=>{
    if(!week.available||!settings.survival||survivalMarked.current===today)return
    survivalMarked.current=today
    markSurvivalDay(householdId,today).then(()=>week.reload())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[week.available,settings.survival,today,householdId])
  // Configuração inicial (migration 014) e rotinas cadastradas
  const [setup,setSetup]=useState<setupApi.SetupState|null>(null)
  const rot=useRotinas(householdId,today)
  const sp=useSprint(householdId)
  const ag=useAgenda(householdId,today)
  const cx=useCasaExtra(householdId,today)
  const cz=useCaes(householdId,today)
  const md=useMeuDia(householdId,today)
  const fx=useFaxinao(householdId)
  const fxLive=fx.list.find(f=>f.status==='andamento')
  const nos=useNos(householdId,today)
  const [sprintOpen,setSprintOpen]=useState(false)
  const [spBusy,setSpBusy]=useState(false)
  const routines=rot.routines
  useEffect(()=>{
    if(!device.ready)return
    let saved:string|null=null
    try{saved=localStorage.getItem('ninho.person')}catch{}
    if(saved==='g'||saved==='s')setPerson(saved)
    else if(me)setPerson(me)
  },[device.ready,me])
  function pickPerson(w:Who){setPerson(w);try{localStorage.setItem('ninho.person',w)}catch{}}
  // Histórico da semana (só na aba Semana; recarrega quando alguém salva uma reunião)
  const loadHistory=async()=>{
    setHistoryError(false)
    try{setHistoryData(await api.loadHistory(householdId,[0,1,2,3].map(i=>addDays(weekStart,-7*i))))}
    catch(e){logError('histórico',e);setHistoryError(true)}
  }
  useEffect(()=>{if(screen==='nos')loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[screen,weekStart,data.meetingTick,householdId])
  // ── AUXILIARES ────────────────────────────────────────
  function requireMe():Who|null{if(!me){openModal('device');return null}return me}
  function patchTask(id:string,patch:Partial<Task>){setTasks(ts=>ts.map(x=>x.id===id?{...x,...patch}:x))}
  function patchRoutines(patches:Map<string,Partial<DogRoutine>>){setDogs(ds=>ds.map(d=>({...d,routines:d.routines.map(r=>patches.has(r.id)?{...r,...patches.get(r.id)}:r)})))}
  const refreshStats=()=>{data.refreshStats().catch(e=>logError('atualizar XP',e))}

  return {
    accidents,ag,casa,cx,cz,data,device,dogs,fx,fxLive,game,historyData,historyError,hour,loadHistory,md,me,names,
    nos,now,nowHM,patchRoutines,patchTask,pickPerson,refreshStats,requireMe,rot,routines,setAccidents,setDogs,
    setHistoryData,setHistoryError,setNames,setSettings,setSetup,setSpBusy,setSprintOpen,setTasks,setXp,settings,
    setup,sp,spBusy,sprintOpen,streak,survivalMarked,tasks,today,todayIndex,week,weekStart,xp,
  }
}

export type Dados = ReturnType<typeof useDados>
