'use client'
// O que as telas mostram: ações rápidas, linhas de item, linha do tempo por pessoa e filtros das tarefas.
// Parte do estado do app (ver components/app/useNinhoApp.tsx, que junta as partes na ordem).
import type { Dog, DogItem, DogRoutine, HItem, Task, Who } from '@/lib/types'
import { CAT, FPT, ROLE, WPT } from '@/lib/constants'
import { type QuickAction } from '@/components/shell/Shell'
import { dogKey } from '@/lib/rotation'
import { hhmm } from '@/lib/dates'
import { doneInPeriod, lastLabel, pausedToday } from '@/lib/frequency'
import { isFixed } from '@/lib/rotation'
import { whyLabel } from '@/lib/split'
import { groupToday, isLate } from '@/lib/today'
import { XPW } from '@/lib/xp'
import { completedByLabel } from '@/lib/completions'
import { toNinhoError } from '@/lib/errors'
import { canEarnOnTime, xpWithBonus } from '@/lib/gamification'
import { Ring } from '@/components/ui/Ring'
import { routineOnDay } from '@/lib/rotinas'
import { dosesToday, type Dose } from '@/lib/meudia'
import { buildTimeline } from '@/lib/timeline'
import { DayTimeline } from '@/components/DayTimeline'
import { type EventKind } from '@/lib/agenda'
import { fmtClock, remainingMs } from '@/lib/sprint'
import { firstName, initials, wCls, catIc } from '@/components/AppModals'
import type { AppCore } from './useAppCore'
import type { Dia } from './useDia'
import type { Tarefas } from './useTarefas'
import type { RotinasSprint } from './useRotinasSprint'
import type { CaesAcoes } from './useCaesAcoes'
import type { NosAcoes } from './useNosAcoes'
import type { CasaAcoes } from './useCasaAcoes'

export function useTelas(c:AppCore&Dia&Tarefas&RotinasSprint&CaesAcoes&NosAcoes&CasaAcoes){
  const {ag,busy,completeDog,dogs,en,fx,fxLive,go,goCasa,goMd,hItems,homeTasks,homeView,isPending,md,mdAdd,me,names,nowHM,openModal,ownerOfItem,ownerOfRoutine,ownerOfTask,person,plan,query,rn,rnRun,routineTurn,routines,setAskOpen,setDayOpen,setShowDone,setSprintOpen,settings,showDone,showError,showToast,sp,swapTask,taskFilter,tasks,today,toggleDogItem,toggleSurvival,toggleTask,unpauseTask,xpOfItem}=c
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

  return {
    actionBtn,dayTag,dogItemRow,dogRow,filtered,itemRow,personCard,q,quickActions,routineGroups,taskRow,timelineOf,
    toggleDose,usedCats,
  }
}

export type Telas = ReturnType<typeof useTelas>
