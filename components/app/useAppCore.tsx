'use client'
// Base do app: navegação, preferências do aparelho, dados carregados, fila sem internet, avisos (toasts) e auxiliares.
// Parte do estado do app (ver components/app/useNinhoApp.tsx, que junta as partes na ordem).
import { useCallback, useEffect, useState, useRef } from 'react'
import type { DogRoutine, HistoryWeek, Task, Who } from '@/lib/types'
import { legacyScreen, type CasaView, type ScreenId } from '@/components/shell/Shell'
import { applyTheme, readTheme, saveTheme, type ThemeId } from '@/lib/theme'
import { DEFAULT_A11Y, applyA11y, effectiveTheme, readA11y, saveA11y, type A11yPrefs } from '@/lib/a11y'
import { addDays } from '@/lib/dates'
import { navigateTo, startBackNav } from '@/lib/backNav'
import * as casaApi from '@/lib/services/casa'
import { useCasa } from '@/hooks/useCasa'
import { useMaintActions } from '@/components/casa/Maintenance'
import { logError, toNinhoError, type NinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import { createPendingGuard } from '@/lib/pending'
import { evaluate, newlyUnlocked, TIER_NAMES, type AchievementState } from '@/lib/gamification'
import { useHomeClock } from '@/hooks/useHomeClock'
import { useDeviceIdentity } from '@/hooks/useDeviceIdentity'
import { useNinhoData } from '@/hooks/useNinhoData'
import * as setupApi from '@/lib/services/onboarding'
import { shouldAutoOpen } from '@/lib/onboarding'
import { useDays } from '@/hooks/useDays'
import { markSurvivalDay } from '@/lib/services/days'
import { useRotinas } from '@/hooks/useRotinas'
import { useSprint } from '@/hooks/useSprint'
import { useAgenda } from '@/hooks/useAgenda'
import * as agApi from '@/lib/services/agenda'
import { useCasaExtra } from '@/hooks/useCasaExtra'
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

export type ToastState={kind:'ok'|'err',msg:string,undo?:()=>void,retry?:()=>void}
export interface Account { who:Who, email:string, onSignOut:()=>void }

export function useAppCore({householdId,account}:{householdId:string,account?:Account}){
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

  return {
    HOME_NAV,a11y,accidents,account,ag,aguaPop,askOpen,busca,casa,casaLast,casaView,closeModal,createDay,cx,cz,
    darkNow,data,dayOpen,device,dogs,fabAway,flushing,fx,fxLive,game,go,goCasa,goMd,guard,historyData,historyError,
    homeView,hour,householdId,isPending,lastAch,loadHistory,loadSetup,maintActions,md,mdAdd,mdFocus,mdTab,me,modal,
    modalData,names,nos,nosView,now,nowHM,onb,openModal,outbox,patchRoutines,patchTask,pending,person,pickHomeView,
    pickPerson,pickSearch,pickTheme,query,queue,refreshStats,requireMe,rot,rotView,routines,saving,screen,
    sendOutbox,setA11y,setA11yState,setAccidents,setAguaPop,setAskOpen,setBusca,setCasaView,setDarkNow,setDayOpen,
    setDogs,setFabAway,setHistoryData,setHistoryError,setHomeView,setMdFocus,setMdTab,setModal,setModalData,
    setNames,setNosView,setOnb,setOutbox,setPending,setPerson,setQuery,setRotView,setSaving,setScreenState,
    setSettings,setSetup,setShowAllToday,setShowDone,setSpBusy,setSprintOpen,setTab,setTaskFilter,setTasks,
    setThemeState,setToast,setWantCup,setWantSprint,setXp,settings,setup,showAllToday,showCard,showDone,showError,
    showToast,shownTheme,sp,spBusy,sprintOpen,streak,survivalMarked,taskFilter,tasks,theme,toast,toastRef,
    toastTimer,today,todayIndex,wantCup,wantSprint,week,weekStart,withPending,xp,
  }
}

export type AppCore = ReturnType<typeof useAppCore>
