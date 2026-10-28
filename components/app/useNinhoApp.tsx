'use client'
// Estado e ações do app (o que era o corpo do NinhoApp). As telas recebem o retorno como `a`.
import { useCallback, useEffect, useState, useRef } from 'react'
import type { Dog, DogItem, DogRoutine, Energy, HistoryWeek, HItem, Meeting, Task, Who } from '@/lib/types'
import { CAT, ENERGY, FEFF, FPT, ROLE, WPT } from '@/lib/constants'
import { legacyScreen, type CasaView, type QuickAction, type ScreenId } from '@/components/shell/Shell'
import { applyTheme, readTheme, saveTheme, type ThemeId } from '@/lib/theme'
import { DEFAULT_A11Y, applyA11y, effectiveTheme, readA11y, saveA11y, type A11yPrefs } from '@/lib/a11y'
import { dogKey } from '@/lib/rotation'
import { addDays, fmtDate, greeting, hhmm, longDateLabel } from '@/lib/dates'
import { doneInPeriod, dueToday, lastLabel, pausedToday } from '@/lib/frequency'
import { isFixed } from '@/lib/rotation'
import { whyLabel, type SplitMode } from '@/lib/split'
import { busyWindows } from '@/lib/busy'
import { navigateTo, startBackNav } from '@/lib/backNav'
import * as casaApi from '@/lib/services/casa'
import { useCasa } from '@/hooks/useCasa'
import { useMaintActions } from '@/components/casa/Maintenance'
import type { MaintenanceItem } from '@/lib/maintenance'
import { groupToday, isLate, planToday } from '@/lib/today'
import { XPW, getChaosInfo, getLevel, levelProgress } from '@/lib/xp'
import { completedByLabel } from '@/lib/completions'
import { logError, toNinhoError, type NinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import { createPendingGuard } from '@/lib/pending'
import { canEarnOnTime, evaluate, newlyUnlocked, xpWithBonus, TIER_NAMES, type AchievementState } from '@/lib/gamification'
import { Ring } from '@/components/ui/Ring'
import { sendMeetSummary } from '@/components/TelegramCard'
import { useHomeClock } from '@/hooks/useHomeClock'
import { useDeviceIdentity } from '@/hooks/useDeviceIdentity'
import { useNinhoData } from '@/hooks/useNinhoData'
import * as setupApi from '@/lib/services/onboarding'
import { shouldAutoOpen } from '@/lib/onboarding'
import { useDays } from '@/hooks/useDays'
import { markSurvivalDay } from '@/lib/services/days'
import { dogCare, nowSummary, routineNow, weekDays } from '@/lib/week'
import { turnBy } from '@/lib/rotation'
import { useRotinas } from '@/hooks/useRotinas'
import * as rotApi from '@/lib/services/rotinas'
import { routineOnDay, runProgress, type Habit, type Routine } from '@/lib/rotinas'
import { TEMPLATES } from '@/lib/onboarding'
import { useSprint } from '@/hooks/useSprint'
import * as spApi from '@/lib/services/sprint'
import { type SprintStart } from '@/components/sprint/SprintPanel'
import { useAgenda } from '@/hooks/useAgenda'
import * as agApi from '@/lib/services/agenda'
import { useCasaExtra } from '@/hooks/useCasaExtra'
import { packTasks, type Pack, type PackItem } from '@/lib/estacoes'
import { setAppBadge } from '@/lib/badge'
import { modeSettings } from '@/lib/reuniao'
import type { Sug } from '@/lib/sugestoes'
import { useCaes } from '@/hooks/useCaes'
import { useMeuDia } from '@/hooks/useMeuDia'
import { enqueue, flush as flushOutbox, newId, readOutbox, writeOutbox, type OutItem } from '@/lib/outbox'
import { isOfflineError } from '@/lib/offline'
import * as mdApi from '@/lib/services/meudia'
import { type MdFocus } from '@/components/meudia/MeuDia'
import type { SearchHit } from '@/lib/search'
import { CASA_GROUP, type CasaGroup, type MdTab } from '@/lib/nav'
import { useNos } from '@/hooks/useNos'
import { useFaxinao } from '@/hooks/useFaxinao'
import { toEvent, toTask, type DayItem } from '@/lib/organizar'
import { guessCategory } from '@/lib/shopping'
import * as nosApi from '@/lib/services/nos'
import { meetingAgenda, progress as chProgress, timeline as nosTimeline, type Agreement, type AgendaSection, type Challenge } from '@/lib/nos'
import { dosesToday, waterOn, workoutsWeek, DEFAULT_SETTINGS as MD_DEFAULT, type Dose } from '@/lib/meudia'
import { buildTimeline } from '@/lib/timeline'
import { mascotSay } from '@/lib/mascote'
import { DayTimeline } from '@/components/DayTimeline'
import * as cApi from '@/lib/services/caes'
import { kindInfo, newBag as newBagStock, upcomingCare, type AccidentRow, type HealthRecord } from '@/lib/caes'
import { type EventKind, type HouseEvent } from '@/lib/agenda'
import { fmtClock, remainingMs, type Sprint } from '@/lib/sprint'
import { firstName, initials, wCls, catIc } from '@/components/AppModals'

export type ToastState={kind:'ok'|'err',msg:string,undo?:()=>void,retry?:()=>void}
export interface Account { who:Who, email:string, onSignOut:()=>void }

export function useNinhoApp({householdId,account}:{householdId:string,account?:Account}){
  const [screen,setScreenState]=useState<ScreenId>('inicio')
  const [casaView,setCasaView]=useState<CasaView>('tarefas')
  const [nosView,setNosView]=useState<'semana'|'desafios'|'historico'|'equilibrio'|'presentes'|'album'>('semana')
  // Casa: a última aba aberta de cada grupo (Comida, Mais)
  const casaLast=useRef<Partial<Record<CasaGroup,CasaView>>>({})
  const [rotView,setRotView]=useState<'rotinas'|'habitos'>('rotinas')
  const [theme,setThemeState]=useState<ThemeId>('aconchego')
  // Conforto do aparelho (Fase 9): tamanho, contraste, movimento, tema automático, cartões do Início
  const [a11y,setA11yState]=useState<A11yPrefs>(DEFAULT_A11Y)
  const [darkNow,setDarkNow]=useState(false)
  useEffect(()=>{
    const mq=typeof matchMedia!=='undefined'?matchMedia('(prefers-color-scheme: dark)'):null
    setThemeState(readTheme(null,!!mq?.matches));setA11yState(readA11y());setDarkNow(!!mq?.matches)
    const on=(e:MediaQueryListEvent)=>setDarkNow(e.matches)
    mq?.addEventListener?.('change',on)
    return()=>mq?.removeEventListener?.('change',on)
  },[])
  const shownTheme=effectiveTheme(a11y,theme,darkNow)
  useEffect(()=>{applyTheme(shownTheme)},[shownTheme])
  useEffect(()=>{applyA11y(a11y)},[a11y])
  const setA11y=(patch:Partial<A11yPrefs>)=>setA11yState(p=>{const n={...p,...patch};saveA11y(n);return n})
  const showCard=(k:string)=>!a11y.hidden.includes(k)
  function pickTheme(t:ThemeId){saveTheme(t);setThemeState(t);if(a11y.autoTheme)setA11y({autoTheme:false})}
  const [modal,setModal]=useState<string|null>(null)
  const [modalData,setModalData]=useState<any>(null)
  const [saving,setSaving]=useState(false)
  const [toast,setToast]=useState<ToastState|null>(null)
  const [taskFilter,setTaskFilter]=useState('all')
  const [query,setQuery]=useState('')
  const [historyData,setHistoryData]=useState<HistoryWeek[]|null>(null)
  const [historyError,setHistoryError]=useState(false)
  const [person,setPerson]=useState<Who>('g')
  const [showDone,setShowDone]=useState<Record<Who,boolean>>({g:false,s:false})
  /** Início: lista por grupos ou linha do tempo do dia (lembrado neste aparelho) */
  const [homeView,setHomeView]=useState<'lista'|'tempo'>('lista')
  useEffect(()=>{try{if(localStorage.getItem('ninho.homeView')==='tempo')setHomeView('tempo')}catch{}},[])
  const pickHomeView=(v:'lista'|'tempo')=>{setHomeView(v);try{localStorage.setItem('ninho.homeView',v)}catch{}}
  const [showAllToday,setShowAllToday]=useState(false)
  // Itens com gravação em andamento (bloqueia clique duplo; o banco também é idempotente)
  const [pending,setPending]=useState<Set<string>>(new Set())
  const guard=useRef(createPendingGuard(setPending)).current
  const toastTimer=useRef<any>(null)
  const toastRef=useRef<ToastState|null>(null)

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
  const [dayOpen,setDayOpen]=useState(false)
  const [askOpen,setAskOpen]=useState(false)
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
  const nos=useNos(householdId,today)
  const [sprintOpen,setSprintOpen]=useState(false)
  const [spBusy,setSpBusy]=useState(false)
  const routines=rot.routines
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

  // Preferências locais: aba e coluna visualizada no celular.
  // A coluna visualizada NÃO muda quem está usando o aparelho.
  useEffect(()=>{
    // O app sempre abre em Hoje (a aba anterior não é mais restaurada)
    try{localStorage.removeItem('ninho.tab')}catch{}
  },[])
  useEffect(()=>{
    if(!device.ready)return
    let saved:string|null=null
    try{saved=localStorage.getItem('ninho.person')}catch{}
    if(saved==='g'||saved==='s')setPerson(saved)
    else if(me)setPerson(me)
  },[device.ready,me])
  /** Vai para uma tela. Aceita também as abas antigas (today, tasks, shop, week, pets, settings). */
  function setTab(t:string){const r=legacyScreen(t);setScreenState(r.screen);if(r.casa)setCasaView(r.casa);window.scrollTo({top:0})}
  const go=(sc:ScreenId)=>setTab(sc)
  const goCasa=(v:CasaView)=>{setTab('casa');setCasaView(v)}
  // Links das notificações (?ir=meudia, desafios, sprint…): abre a tela certa e limpa o endereço
  const [wantSprint,setWantSprint]=useState(false)
  const [mdTab,setMdTab]=useState<MdTab>('hoje'),[mdFocus,setMdFocus]=useState<MdFocus>(null)
  /** Pop-up de água: >0 = aberto pelo lembrete (força); o próprio pop-up decide se abre sozinho */
  const [aguaPop,setAguaPop]=useState(0)
  /** Atalho do ícone "+1 copo": registra assim que o Meu dia carregar e mostra o pop-up (dá para desfazer) */
  const [wantCup,setWantCup]=useState(false)
  /** 🔍 Busca em tudo (lupa no topo ou Ctrl/⌘+K) */
  const [busca,setBusca]=useState(false)
  useEffect(()=>{
    const k=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setBusca(true)}}
    window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)
  },[])
  /** Abre uma parte do Meu dia (e, se pedido, rola até um cartão). */
  const goMd=(t:MdTab,what?:NonNullable<MdFocus>['what'])=>{setTab('eu');setMdTab(t);if(what)setMdFocus({what,n:Date.now()})}
  // ── VOLTAR DO CELULAR (lib/backNav) ──
  // Cada tela/aba vira uma entrada no histórico; as janelas (folhas) fecham com o voltar;
  // no Início, o voltar pede "toque de novo para sair" em vez de fechar o app de cara.
  const HOME_NAV={screen:'inicio',casa:'tarefas',nos:'semana',rot:'rotinas',md:'hoje'}
  useEffect(()=>startBackNav({screen,casa:casaView,nos:nosView,rot:rotView,md:mdTab},n=>{
    setScreenState(n.screen as ScreenId);setCasaView(n.casa as CasaView);setNosView(n.nos as any);setRotView(n.rot as any);setMdTab(n.md as MdTab);window.scrollTo({top:0})
  },n=>{
    if(n.screen!=='inicio')return HOME_NAV
    showToast('Toque em voltar de novo para sair do Ninho');return null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }),[])
  useEffect(()=>{navigateTo({screen,casa:casaView,nos:nosView,rot:rotView,md:mdTab})},[screen,casaView,nosView,rotView,mdTab])
  useEffect(()=>{casaLast.current[CASA_GROUP[casaView]]=casaView},[casaView])
  // botão + flutuante: some enquanto rola para baixo (não cobre os botões dos itens) e volta ao subir
  const [fabAway,setFabAway]=useState(false)
  useEffect(()=>{let last=window.scrollY
    const on=()=>{const y=window.scrollY;if(y>last+8&&y>120)setFabAway(true);else if(y<last-8||y<=120)setFabAway(false);last=y}
    window.addEventListener('scroll',on,{passive:true});return()=>window.removeEventListener('scroll',on)},[])
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

  // ── TOASTS ────────────────────────────────────────────
  toastRef.current=toast
  function showToast(msg:string,undo?:()=>void){setToast({kind:'ok',msg,undo});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),undo?4500:2600)}
  function showError(e:NinhoError,retry?:()=>void){
    const r=e.retryable?retry:undefined
    setToast({kind:'err',msg:e.userMessage,retry:r})
    clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),r?8000:6000)
  }
  function closeModal(){setModal(null);setModalData(null)}
  function openModal(m:string,d?:any){setModal(m);setModalData(d??null)}

  // ── AUXILIARES ────────────────────────────────────────
  function requireMe():Who|null{if(!me){openModal('device');return null}return me}
  async function withPending(keys:string[],fn:()=>Promise<void>){await guard.run(keys,fn)}
  const isPending=(k:string)=>pending.has(k)
  function patchTask(id:string,patch:Partial<Task>){setTasks(ts=>ts.map(x=>x.id===id?{...x,...patch}:x))}
  function patchRoutines(patches:Map<string,Partial<DogRoutine>>){setDogs(ds=>ds.map(d=>({...d,routines:d.routines.map(r=>patches.has(r.id)?{...r,...patches.get(r.id)}:r)})))}
  const refreshStats=()=>{data.refreshStats().catch(e=>logError('atualizar XP',e))}

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

  // ── AÇÕES RÁPIDAS (botão + no celular, "Ação rápida" no menu lateral) ──
  const quickActions:QuickAction[]=[
    {id:'task',icon:'tarefa',label:'Nova tarefa',sub:'Algo com começo e fim',run:()=>openModal('task',null)},
    ...(me?[{id:'dia',icon:'reuniao',label:'Organizar meu dia',sub:'Fale tudo; a IA põe em ordem',run:()=>setDayOpen(true)},{id:'pergunta',icon:'nos',label:'Perguntar ao Ninho',sub:'Mancha, limpeza, cachorras…',run:()=>setAskOpen(true)}]:[]),
    ...(fx.available?[{id:'faxinao',icon:'casa',label:fxLive?'Faxinão em andamento':'Faxinão com IA',sub:fxLive?'Ver o que é seu agora':'Fale tudo; a IA organiza a ordem',run:()=>goCasa('faxinao')}]:[]),
    {id:'shop',icon:'compra',label:'Adicionar compra',sub:'Na lista do mercado',run:()=>{goCasa('compras');setTimeout(()=>(document.querySelector('.shop-add input') as HTMLInputElement|null)?.focus(),250)}},
    ...(sp.available?[{id:'sprint',icon:'sprint',label:'Sprint do Ninho',sub:sp.active?`Em andamento · ${fmtClock(remainingMs(sp.active,sp.now))}`:'Mutirão de 10, 15 ou 25 min',run:()=>setSprintOpen(true)}]:[]),
    {id:'routine',icon:'rotinas',label:'Iniciar rotina',sub:rn.now?rn.now.title:rn.next?`Próxima: ${rn.next.title}`:'Ver as rotinas',run:()=>go('rotinas')},
    ...(md.available&&me?[
      {id:'comi',icon:'tarefa',label:'Comi',sub:'Próxima refeição do plano',run:()=>goMd('comida','comi')},
      {id:'refeicao',icon:'compra',label:'Registrar refeição',sub:'Escrevendo ou pela foto do prato',run:()=>goMd('comida','refeicao')},
      {id:'meudia',icon:'agua',label:'Meu dia',sub:'Água, sono, remédios e treino',run:()=>goMd('hoje')},
      {id:'peso',icon:'energia',label:'Peso e medidas',sub:'Ou ler a bioimpedância',run:()=>goMd('corpo','peso')},
      {id:'foto',icon:'eu',label:'Foto de evolução',sub:'Frente, lado ou costas',run:()=>goMd('corpo','foto')},
    ]:[]),
    {id:'dogs',icon:'caes',label:'Cuidado dos cães',sub:'Comida, passeio, acidente',run:()=>go('caes')},
    {id:'checkin',icon:'nos',label:'Check-in do dia',sub:'Humor e energia',run:()=>{go('inicio');setTimeout(()=>document.getElementById('checkin')?.scrollIntoView({behavior:'smooth',block:'center'}),250)}},
    ...(ag.available?[{id:'event',icon:'reuniao',label:'Agenda da casa',sub:'Consulta, visita, entrega, vencimento',run:()=>{goCasa('agenda');openModal('event',{event:null,kind:'compromisso' as EventKind})}}]:[]),
    {id:'maint',icon:'ferramenta',label:'Nova manutenção',sub:'Filtro, vacina, revisão…',run:()=>openModal('maint',null)},
    {id:'meeting',icon:'reuniao',label:'Reunião semanal',sub:'15 minutos, sem cobranças',run:()=>openModal('meeting')},
    {id:'energy',icon:'energia',label:'Energia da semana',sub:en.l,run:()=>openModal('energy')},
    {id:'survival',icon:'escudo',label:settings.survival?'Sair do modo sobrevivência':'Modo sobrevivência',sub:settings.survival?'Ativo · só essenciais':'Só o essencial por um tempo',run:toggleSurvival},
  ]

  // Rotinas que já existem (rotinas dos cães, agrupadas como em Início)
  const routineGroups=(()=>{
    const m=new Map<string,{title:string,time:string|null,frequency:string,dogs:string[],r:DogRoutine}>()
    dogs.forEach(d=>d.routines.forEach(r=>{const k=dogKey(r);const g=m.get(k)||{title:r.title,time:r.scheduled_time,frequency:r.frequency,dogs:[],r};g.dogs.push(d.name);m.set(k,g)}))
    return Array.from(m.values()).sort((a,b)=>(hhmm(a.time)||'99').localeCompare(hhmm(b.time)||'99'))
  })()

  // ── RENDER HELPERS ────────────────────────────────────
  /** Compromisso no horário (⚠) ou tarefa que veio da outra hoje (↪), pela Agenda. */
  const dayTag=(id:string)=>{
    const cf=plan.conflictOf(id),w=plan.whyOf(id)
    if(cf)return <span className="tag-cf" title="Compromisso no mesmo horário">⚠ {cf.title} {cf.start}–{cf.end}</span>
    if(w?.why.kind==='day')return <span className="tag-day" title={whyLabel(w,names,today)}>↪ hoje com {firstName(names[w.who])}</span>
    return null
  }
  const taskRow=(t:Task,o:{actions?:boolean,next?:boolean}={})=>{
    const actions=o.actions!==false
    const other:Who=ownerOfTask(t)==='g'?'s':'g'
    const late=isLate(t,nowHM)
    return(
      <div key={t.id} className={`tr ${t.completed_today?'done':''} ${o.next?'next':''}`}>
        <button className={`chk ${t.essential?'ess':''} ${isPending('task:'+t.id)?'busy':''}`} onClick={()=>toggleTask(t)} disabled={isPending('task:'+t.id)} aria-busy={isPending('task:'+t.id)} aria-label={t.completed_today?`Desmarcar ${t.title}`:`Concluir ${t.title}`}>✓</button>
        <div className="trb" onClick={()=>toggleTask(t)}>
          <div className="trt">{t.title}</div>
          <div className="trm">
            <span title={CAT[t.category]}>{catIc(t.category)}</span>
            {o.next&&<span className="tag-next">▸ próxima</span>}
            {t.essential&&!t.completed_today&&<span className="tag-e" title="Essencial">●<span className="lg-only"> essencial</span></span>}
            {t.scheduled_time&&<span className={`tag-t ${late?'late':''}`}>⏰ {hhmm(t.scheduled_time)}</span>}
            {t.frequency!=='daily'&&<span><span className="lg-only">{FPT[t.frequency]}{!t.completed_today&&t.frequency!=='once'&&' · '}</span>{!t.completed_today&&t.frequency!=='once'&&lastLabel(t.prev_done||null,today)}</span>}
            {!isFixed(t)&&<span className="tag-r" title="Rodízio: alterna entre vocês">↻<span className="lg-only"> rodízio</span></span>}
            {t.completed_today&&<span className="tag-by" title="Quem concluiu">✓ {completedByLabel(t.completed_by_today,names)}</span>}
            {t.priority==='alta'&&!t.completed_today&&<span className="tag-pri" title="Prioridade alta">↑<span className="lg-only"> alta</span></span>}
            {!!t.checklist?.length&&<span className="tag-ck" title="Checklist">☑ {t.checklist.filter(c=>c.d).length}/{t.checklist.length}</span>}
            {t.notes&&<span title={t.notes} aria-label="Tem observação">📝</span>}
            {t.help_by&&!t.completed_today&&<span className="tag-help" title="Pedido de ajuda">🙋 {t.help_by===me?'você pediu ajuda':`${firstName(names[t.help_by])} pediu ajuda`}</span>}
            {!t.completed_today&&dayTag(t.id)}
          </div>
        </div>
        {canEarnOnTime(t,nowHM)
          ?<span className={`xp xp-${wCls(t.weight)} bonus`} title={`Até ${hhmm(t.scheduled_time)}: XP ×1,5`}>+{xpWithBonus(XPW[t.weight],true)}⚡</span>
          :<span className={`xp xp-${wCls(t.weight)}`} title={WPT[t.weight]}>+{XPW[t.weight]}</span>}
        {actions&&<button className="ib desk" onClick={()=>swapTask(t)} title={`Passar para ${firstName(names[other])}`} aria-label={`Passar para ${firstName(names[other])}`}>⇄</button>}
        {actions&&<button className="ib desk" onClick={()=>openModal('task',t)} title="Editar" aria-label="Editar">✎</button>}
        {actions&&!t.completed_today&&<button className="ib desk" onClick={()=>openModal('taskmenu',t)} title="Pular ou deixar para amanhã" aria-label={`Mais opções de ${t.title}`}>⏭</button>}
        {actions&&<button className="ib mob" onClick={()=>openModal('taskmenu',t)} aria-label={`Opções de ${t.title}`}>⋯</button>}
      </div>
    )
  }

  const dogItemRow=(it:DogItem,o:{next?:boolean}={})=>{
    const late=isLate(it,nowHM)
    const multi=it.parts.length>1
    const busy=it.parts.some(p=>isPending('dog:'+p.r.id))
    const by=Array.from(new Set(it.parts.filter(p=>p.r.completed_today).map(p=>completedByLabel(p.r.completed_by_today,names)))).join(' e ')
    return(
      <div key={'dog:'+it.key} className={`tr ${it.completed_today?'done':''} ${o.next?'next':''}`}>
        <button className={`chk ${busy?'busy':''}`} disabled={busy} aria-busy={busy} onClick={()=>toggleDogItem(it)} aria-label={it.completed_today?`Desmarcar ${it.title}`:`Concluir ${it.title}`}>✓</button>
        <div className="trb" onClick={()=>toggleDogItem(it)}>
          <div className="trt">{it.title}</div>
          <div className="trm">
            <span>🐾 {it.parts.map(p=>p.dog.name+(multi&&p.r.completed_today&&!it.completed_today?' ✓':'')).join(', ')}</span>
            {o.next&&<span className="tag-next">▸ próxima</span>}
            {it.scheduled_time&&<span className={`tag-t ${late?'late':''}`}>⏰ {hhmm(it.scheduled_time)}</span>}
            {it.frequency!=='daily'&&<span className="lg-only">{FPT[it.frequency]||it.frequency}</span>}
            <span className="tag-r" title="Rotinas dos cães alternam entre vocês">↻<span className="lg-only"> rodízio</span></span>
            {it.completed_today&&<span className="tag-by" title="Quem concluiu">✓ {by}</span>}
            {!it.completed_today&&dayTag('dog:'+it.key)}
          </div>
        </div>
        {canEarnOnTime(it,nowHM)
          ?<span className="xp xp-l bonus" title={`Até ${hhmm(it.scheduled_time)}: XP ×1,5`}>+{xpWithBonus(1,true)*it.parts.length}⚡</span>
          :<span className="xp xp-l">+{it.parts.length}</span>}
      </div>
    )
  }
  const itemRow=(i:HItem,o:{actions?:boolean,next?:boolean}={})=>i.task?taskRow(i.task,o):dogItemRow(i.dog!,o)

  /** Linha do tempo de uma pessoa: tarefas e cães dela, agenda de hoje, rotinas com passos e (só para quem usa o aparelho) remédios. */
  const timelineOf=(who:Who,items:HItem[])=>buildTimeline({who,nowHM,items,
    events:ag.available?ag.events.filter(e=>e.date===today):[],
    routines:routines.filter(r=>routineOnDay(r,today)).filter(r=>r.assign_mode==='shared'||(r.assign_mode==='rotation'?routineTurn(r):r.assign_mode)===who)
      .map(r=>{const pr=rnRun(r)!;return{r,done:pr.complete,steps:pr.total?`${pr.done}/${pr.total} passos`:null}}),
    doses:md.available&&who===me?dosesToday(md.meds,md.logs,who,today,nowHM):[]})
  const toggleDose=(d:Dose)=>{if(!me)return;(d.taken?md.remove(d.taken):mdAdd(me,'remedio',null,{med_id:d.med.id,name:d.med.name,time:d.time})).then(()=>showToast(d.taken?'Desmarcado':`💊 ${d.med.name} tomado`)).catch(e=>showError(toNinhoError(e,'registrar remédio')))}
  const personCard=(who:Who)=>{
    const all=hItems.filter(i=>ownerOfItem(i)===who)
    const pend=all.filter(i=>!i.completed_today)
    const done=all.filter(i=>i.completed_today)
    const pct=all.length?Math.round(done.length/all.length*100):0
    const doneXP=done.reduce((s,i)=>s+xpOfItem(i),0)
    const essLeft=pend.filter(i=>i.essential).length
    return(
      <section key={who} id={me===who?'minhas':undefined} className="card pcard" data-hide={person!==who?'1':'0'}>
        <div className="ph">
          <div className={`av av-${who}`}>{initials(names[who])}</div>
          <div style={{minWidth:0}}>
            <div className="pname">{names[who]}{me===who&&<span className="you" title="Quem está usando este aparelho">você</span>}</div>
            <div className="prole">{ROLE[who]}{essLeft>0&&<> · <span style={{color:'var(--cor)'}}>{essLeft} essencia{essLeft>1?'is':'l'}</span></>}</div>
          </div>
          <Ring pct={pct} color={who==='g'?'var(--green)':'var(--pur)'} label={`${done.length}/${all.length}`}/>
        </div>
        {all.length===0?(homeTasks.some(t=>ownerOfTask(t)===who)||dogs.length>0?(
          <div className="alldone">🎉 Nada pendente para hoje<small>As tarefas do período já estão em dia</small></div>
        ):(
          <div className="empty"><span className="empty-icon">📋</span>{who==='g'?'Nenhuma tarefa ainda':'Nenhuma tarefa atribuída'}
            <div><button className="btn btn-s" onClick={()=>goCasa('sugestoes')}>✦ Ver sugestões</button></div>
          </div>
        )):<>
          {homeView==='tempo'?<DayTimeline tl={timelineOf(who,all)} nowHM={nowHM} busy={e=>e.item?(e.item.task?isPending('task:'+e.item.task.id):e.item.dog!.parts.some(x=>isPending('dog:'+x.r.id))):false}
            onItem={i=>i.task?toggleTask(i.task):toggleDogItem(i.dog!)} onDose={toggleDose} onRoutine={()=>go('rotinas')} onAgenda={()=>goCasa('agenda')}/>:<>
          {pend.length===0&&<div className="alldone">🎉 Tudo feito por hoje!<small>+{doneXP} XP conquistados</small></div>}
          {(()=>{
            const groups=groupToday(pend,nowHM,today)
            const nextId=groups.find(g=>['morning','afternoon','night'].includes(g.k))?.items[0]?.id
            return groups.map(g=>(
              <div key={g.k}>
                <div className={`cdiv ${g.k==='late'?'late':''}`}>{g.label}<span className="n">{g.items.length}</span></div>
                {g.items.map(i=>itemRow(i,{next:i.id===nextId}))}
              </div>
            ))
          })()}
          {done.length>0&&<>
            <button className="dtog" onClick={()=>setShowDone(p=>({...p,[who]:!p[who]}))} aria-expanded={showDone[who]}>
              <span style={{width:12}}>{showDone[who]?'▾':'▸'}</span>Concluídas ({done.length})
              <span className="mono" style={{marginLeft:'auto',color:'var(--green)',fontSize:12}}>+{doneXP} XP</span>
            </button>
            {showDone[who]&&done.map(i=>itemRow(i,{actions:false}))}
          </>}
          </>}
          {(()=>{const paused=homeTasks.filter(t=>pausedToday(t,today)&&ownerOfTask(t)===who);return paused.length>0&&<div className="paused">
            <div className="paused-h">⏸ Puladas ou para amanhã ({paused.length})</div>
            {paused.map(t=><div key={t.id} className="paused-r">
              <span className="paused-t">{t.title}</span>
              <span className="paused-k">{t.skip!.kind==='snooze'?'amanhã':t.frequency==='daily'?'pulada hoje':'pulada no período'}</span>
              <button className="lnk" disabled={isPending('task:'+t.id)} onClick={()=>unpauseTask(t)}>↺ Voltar</button>
            </div>)}
          </div>})()}
        </>}
      </section>
    )
  }

  const dogRow=(r:DogRoutine,o:{dogName?:string,dog?:Dog}={})=>{
    // "sat" = já feita neste período (ex.: banho semanal feito na segunda)
    const sat=!r.completed_today&&doneInPeriod(r,today)
    const late=isLate(r,nowHM)
    const busy=isPending('dog:'+r.id)
    return(
      <div key={r.id} className={`dr ${r.completed_today||sat?'done':''} ${sat?'sat':''}`}>
        <button className={`chk ${r.completed_today||sat?'ok':''} ${busy?'busy':''}`} disabled={sat||busy} aria-busy={busy} onClick={()=>completeDog(r)} aria-label={r.completed_today?`Desmarcar ${r.title}`:`Concluir ${r.title}`}>✓</button>
        <span className="dr-t" onClick={()=>!sat&&completeDog(r)}>{r.title}</span>
        {o.dogName&&<span className="dr-m">{o.dogName}</span>}
        {r.completed_today&&<span className="dr-m" title="Quem concluiu">{completedByLabel(r.completed_by_today,names)}</span>}
        {sat?<span className="dr-m">✓ {lastLabel(r.prev_done||null,today)}</span>
          :r.frequency!=='daily'&&<span className="bdg bdg-n">{FPT[r.frequency]||r.frequency}</span>}
        {r.scheduled_time&&<span className={`dr-m ${late?'late':''}`}>{hhmm(r.scheduled_time)}</span>}
        {!sat&&!r.completed_today&&(()=>{const w=ownerOfRoutine(r);return <span className={`mini av-${w}`} title={`Vez de ${firstName(names[w])}`}>{names[w].slice(0,1).toUpperCase()}</span>})()}
        {o.dog&&<button className="ib" onClick={()=>openModal('routine',{dog:o.dog,routine:r})} title="Editar rotina" aria-label={`Editar ${r.title}`}>✎</button>}
      </div>
    )
  }

  const actionBtn=(ic:string,t:string,s:string,onClick:()=>void,tint?:string)=>(
    <button className="act" onClick={onClick}>
      <span className="act-ic" style={tint?{background:tint}:undefined}>{ic}</span>
      <span style={{minWidth:0}}><div className="act-t">{t}</div><div className="act-s">{s}</div></span>
      <span className="chev">›</span>
    </button>
  )

  // ── TAREFAS: filtros ──────────────────────────────────
  const q=query.trim().toLowerCase()
  const filtered=tasks.filter(t=>{
    if(taskFilter==='essential'&&!t.essential)return false
    if(taskFilter==='alta'&&t.priority!=='alta')return false
    if(taskFilter==='help'&&!t.help_by)return false
    if(taskFilter==='g'&&t.assigned_to!=='g')return false
    if(taskFilter==='s'&&t.assigned_to!=='s')return false
    if(taskFilter==='r'&&t.assigned_to)return false
    if(taskFilter==='notime'&&t.scheduled_time)return false
    if(CAT[taskFilter]&&t.category!==taskFilter)return false
    if(q&&!t.title.toLowerCase().includes(q))return false
    return true
  })
  const usedCats=Object.keys(CAT).filter(k=>tasks.some(t=>t.category===k))

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

  return {
    HOME_NAV,SKIP_LABEL,a11y,accidents,account,act,actionBtn,activeCh,activeChs,addAccident,addHouseTemplate,
    addMaintTemplates,addPack,addRoutineTemplate,addSuggestion,ag,agenda,aguaPop,allRoutines,allToday,archiveHabit,
    archiveRoutine,archiveTasks,archived,askHelp,askOpen,assignTask,autoDistribute,balanced,billPaid,busca,busy,
    buyFood,care,casa,casaLast,casaOk,casaView,challenge,challengeStatus,chaos,ci,closeModal,completeDog,countFor,
    createChallenge,createDay,cx,cz,dailyTasks,darkNow,data,dateLabel,dayOpen,dayPct,dayTag,deleteChallenge,
    deleteEvent,deleteHealth,deleteHouseTemplate,deleteTask,device,dogCareAgenda,dogDaily,dogDone,dogItemRow,
    dogItems,dogLoad,dogName,dogRow,dogTasks,dogs,doneToday,dueList,en,eventDone,fabAway,filtered,finishRoutine,
    finishSprint,fixAccident,flushing,focusMode,fx,fxLive,gP,gS,game,go,goCasa,goMd,guard,hItems,handoffToday,
    healthSoon,hello,helpReq,hiddenCount,histMeeting,historyData,historyError,homeTasks,homeView,hour,householdId,
    inWk,isPending,itemRow,itemTitle,lastAch,lastMeeting,loadHistory,loadOf,loadSetup,lv,maintActions,markChallenge,
    markDogs,mascot,maxHist,md,mdAdd,mdFocus,mdTab,me,modal,modalData,myLeft,names,newBag,nos,nosTl,nosView,now,
    nowHM,nowSum,onAlbumError,onShoppingFinished,onb,openModal,outbox,ownerOfItem,ownerOfRoutine,ownerOfTask,
    patchRoutines,patchTask,pauseOk,pauseSprint,pauseTask,pauseUntil,pending,periodOk,person,personCard,
    pickHomeView,pickPerson,pickSearch,pickTheme,plan,puppies,q,query,queue,quickActions,quickUpdate,refreshStats,
    removeAccident,removeDog,removeMaint,removeRoutine,requireMe,restoreTask,rn,rnRun,rot,rotCount,rotView,
    routineGroups,routineSteps,routineTurn,routines,sS,save,saveCheckin,saveEvent,saveHabitDraft,saveHealth,
    saveMaint,saveMeeting,savePet,saveRoutine,saveRoutineDraft,saveRoutineTemplate,saveSettings,saveSobrou,
    saveSplit,saveTask,saving,screen,sendOutbox,setA11y,setA11yState,setAccidents,setAguaPop,setArchived,setAskOpen,
    setBusca,setCasaView,setDarkNow,setDayOpen,setDogs,setEnergy,setFabAway,setHistoryData,setHistoryError,
    setHomeView,setMdFocus,setMdTab,setModal,setModalData,setNames,setNosView,setOnb,setOutbox,setPending,setPerson,
    setQuery,setRotView,setSaving,setScreenState,setSettings,setSetup,setShowAllToday,setShowDone,setSpBusy,
    setSprintOpen,setSprintTasks,setTab,setTaskFilter,setTasks,setThemeState,setToast,setTplBusy,setWantCup,
    setWantSprint,setXp,settings,setup,sharedLines,showAllToday,showCard,showDone,showError,showToast,shownTheme,sp,
    spBusy,sprintOpen,startSprint,stepRoutine,streak,survivalMarked,swapTask,taskFilter,taskRow,tasks,theme,
    thisMeeting,thisMeetingRow,timelineOf,toast,toastRef,toastTimer,today,todayIndex,todayTasks,together,
    toggleAgreement,toggleDogItem,toggleDose,toggleHabit,toggleSurvival,toggleTask,tot,tplBusy,undoHandoff,
    unpauseTask,updateDog,updateName,updateTaskFields,usedCats,wantCup,wantSprint,week,weekInfo,weekStart,
    withPending,xp,xpOfItem,xpPct,
  }
}

export type App = ReturnType<typeof useNinhoApp>
