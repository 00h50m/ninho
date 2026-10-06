'use client'
import { useEffect, useState, useRef } from 'react'
import type { Accident, Dog, DogItem, DogRoutine, Energy, HistoryWeek, HItem, Meeting, Names, Task, Who } from '@/lib/types'
import { ACCIDENT_PLACES, CAT, DR_DEF, DR_PUP, ENERGY, FEFF, FPT, RFREQ, ROLE, SUGG, WPT } from '@/lib/constants'
import { BottomNav, Icon, QuickActionsSheet, SideNav, SubTabs, legacyScreen, type CasaView, type QuickAction, type ScreenId } from '@/components/shell/Shell'
import { THEMES, applyTheme, readTheme, saveTheme, type ThemeId } from '@/lib/theme'
import { dogKey } from '@/lib/rotation'
import { addDays, fmtDate, greeting, hhmm, longDateLabel, timeOfInstant } from '@/lib/dates'
import { doneInPeriod, dueToday, lastDone, lastLabel, pausedToday, weekdaysLabel, WEEKDAY_SHORT } from '@/lib/frequency'
import { isFixed } from '@/lib/rotation'
import { whyLabel, type SplitMode } from '@/lib/split'
import * as casaApi from '@/lib/services/casa'
import { useCasa } from '@/hooks/useCasa'
import { ShoppingTab } from '@/components/casa/ShoppingTab'
import { MaintenanceForm, MaintenanceSection, MaintTemplatesSheet, MaintTodayCard, useMaintActions } from '@/components/casa/Maintenance'
import { shoppingCounts } from '@/lib/shopping'
import type { MaintenanceItem } from '@/lib/maintenance'
import { byTime, groupToday, isLate, planToday } from '@/lib/today'
import { LEVELS, XPW, getChaosInfo, getLevel, levelProgress, weekDots } from '@/lib/xp'
import { completedByLabel } from '@/lib/completions'
import { logError, toNinhoError, type NinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import { createPendingGuard } from '@/lib/pending'
import { canEarnOnTime, evaluate, newlyUnlocked, xpWithBonus, TIER_NAMES, type AchievementState } from '@/lib/gamification'
import { Scoreboard } from '@/components/gamification/Scoreboard'
import { StreaksCard } from '@/components/gamification/StreaksCard'
import { Achievements } from '@/components/gamification/Achievements'
import { BetModal } from '@/components/gamification/BetModal'
import { Ring } from '@/components/ui/Ring'
import { Sheet } from '@/components/ui/Sheet'
import { DeviceIdentityModal } from '@/components/DeviceIdentityModal'
import { NotificationsCard } from '@/components/NotificationsCard'
import { TelegramCard, fetchAiTips } from '@/components/TelegramCard'
import { useHomeClock } from '@/hooks/useHomeClock'
import { useDeviceIdentity } from '@/hooks/useDeviceIdentity'
import { useNinhoData } from '@/hooks/useNinhoData'
import { Onboarding } from '@/components/onboarding/Onboarding'
import * as setupApi from '@/lib/services/onboarding'
import { LAST_STEP, daysLabel, shouldAutoOpen } from '@/lib/onboarding'
import { useDays } from '@/hooks/useDays'
import { markSurvivalDay } from '@/lib/services/days'
import { dogCare, nowSummary, routineNow, weekDays } from '@/lib/week'
import { turnBy } from '@/lib/rotation'
import { WeekStrip } from '@/components/inicio/WeekStrip'
import { CheckinCard } from '@/components/inicio/CheckinCard'
import { RoutineNowCard } from '@/components/inicio/RoutineNowCard'
import { useRotinas } from '@/hooks/useRotinas'
import * as rotApi from '@/lib/services/rotinas'
import { routineOnDay, runProgress, type Habit, type Routine } from '@/lib/rotinas'
import { TEMPLATES } from '@/lib/onboarding'
import { RoutinesView } from '@/components/rotinas/RoutinesView'
import { HabitsView } from '@/components/rotinas/HabitsView'
import { HabitEditor, RoutineEditor, TemplatesSheet } from '@/components/rotinas/Editors'
import { useSprint } from '@/hooks/useSprint'
import * as spApi from '@/lib/services/sprint'
import { SprintPanel, type SprintStart } from '@/components/sprint/SprintPanel'
import { useAgenda } from '@/hooks/useAgenda'
import * as agApi from '@/lib/services/agenda'
import { AgendaView, EventSheet } from '@/components/casa/Agenda'
import { useCaes } from '@/hooks/useCaes'
import { useMeuDia } from '@/hooks/useMeuDia'
import * as mdApi from '@/lib/services/meudia'
import { MeuDiaView, MeuDiaCard } from '@/components/meudia/MeuDia'
import * as cApi from '@/lib/services/caes'
import { DogAvatar, DogHealthBlock, DogProfileSheet, HealthSheet, PuppyPanel } from '@/components/caes/DogPanels'
import { kindInfo, upcomingCare, type AccidentRow, type HealthKind, type HealthRecord } from '@/lib/caes'
import { bills as agBills, agendaEntries, kindIcon, type EventKind, type HouseEvent } from '@/lib/agenda'
import { areaLabel, fmtClock, remainingMs, type Sprint } from '@/lib/sprint'

function firstName(n:string){return (n||'').split(' ')[0]}
function initials(n:string){return (n||'??').slice(0,2).toUpperCase()}
function wCls(w:string){return w==='light'?'l':w==='medium'?'m':'h'}
function byCat(list:Task[]){const g:Record<string,Task[]>={};list.forEach(t=>{(g[t.category]=g[t.category]||[]).push(t)});return Object.entries(g)}
function catIc(c:string){return (CAT[c]||'').split(' ')[0]}


// ── PEÇAS DE UI (fora do componente principal para não remontar a cada render) ──
// Horário editável direto na lista de Tarefas
function QuickTime({value,onSave}:{value:string,onSave:(v:string)=>void}){
  const[edit,setEdit]=useState(false)
  const[v,setV]=useState(value)
  useEffect(()=>{setV(value)},[value])
  const commit=()=>{setEdit(false);if(v!==value)onSave(v)}
  if(!edit&&!value)return <button className="bdg bdg-n qb" onClick={e=>{e.stopPropagation();setEdit(true)}} title="Definir horário">+ horário</button>
  return(
    <span className="qtw" onClick={e=>e.stopPropagation()}>
      <input type="time" className="qtime" value={v} autoFocus={edit} onChange={e=>setV(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();if(e.key==='Escape'){setV(value);setEdit(false)}}} aria-label="Horário"/>
      {v&&<button className="qx" onMouseDown={e=>e.preventDefault()} onClick={()=>{setV('');setEdit(false);onSave('')}} title="Tirar horário" aria-label="Tirar horário">✕</button>}
    </span>
  )
}

function TaskFormModal({task,names,saving,casaOk,onClose,onSave,onDelete}:{task:Task|null,names:Names,saving:boolean,casaOk?:boolean,onClose:()=>void,onSave:(d:any,id?:string)=>void,onDelete:(id:string)=>void}){
  const t=task
  const editing=!!t?.id
  const[title,setTitle]=useState(t?.title||'')
  const[cat,setCat]=useState(t?.category||'general')
  const[weight,setWeight]=useState<'light'|'medium'|'heavy'>(t?.weight||'medium')
  const[freq,setFreq]=useState(t?.frequency||'weekly')
  const[assign,setAssign]=useState(t?.assigned_to||'')
  const[time,setTime]=useState(hhmm(t?.scheduled_time||null))
  const[ess,setEss]=useState(t?.essential||false)
  const[days,setDays]=useState<number[]>(t?.weekdays||[])
  const[due,setDue]=useState(t?.due_date||'')
  const[prio,setPrio]=useState<'alta'|'normal'|'baixa'>(t?.priority||'normal')
  const[notes,setNotes]=useState(t?.notes||'')
  const[check,setCheck]=useState<Array<{t:string,d:boolean}>>(t?.checklist||[])
  const[newItem,setNewItem]=useState('')
  const[hist,setHist]=useState<Awaited<ReturnType<typeof api.taskHistory>>|null>(null)
  useEffect(()=>{if(editing&&t?.id)api.taskHistory(t.id).then(setHist).catch(()=>setHist([]))},[editing,t?.id])
  const addItem=()=>{const v=newItem.trim();if(!v||check.length>=30)return;setCheck(c=>[...c,{t:v.slice(0,80),d:false}]);setNewItem('')}
  const usesDays=['daily','weekly','biweekly'].includes(freq)
  const toggleDay=(d:number)=>setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d])
  const handle=()=>{if(!title.trim()||saving)return
    const wd=usesDays&&days.length&&days.length<7?[...days].sort():null
    const extra:any={}
    // Só envia as colunas novas quando usadas (o app funciona mesmo antes da migration 008)
    if(wd||t?.weekdays)extra.weekdays=wd
    if((freq==='once'&&due)||t?.due_date)extra.due_date=freq==='once'&&due?due:null
    // Migration 019: só envia quando o banco já tem as colunas
    if(casaOk){extra.priority=prio;extra.notes=notes.trim()||null;extra.checklist=check.filter(c=>c.t.trim())}
    onSave({title:title.trim(),category:cat,weight,frequency:freq,assigned_to:assign||null,scheduled_time:time||null,essential:ess,...extra},editing?t!.id:undefined)}
  return(
    <Sheet title={editing?'Editar tarefa':'Nova tarefa'} onClose={onClose} footer={<>
      {editing&&<button className="btn btn-danger" disabled={saving} onClick={()=>onDelete(t!.id)}>Remover</button>}
      <button className="btn btn-p" disabled={!title.trim()||saving} onClick={handle}>{saving?'Salvando…':editing?'Salvar alterações':'Criar tarefa'}</button>
    </>}>
      <label className="fl">Nome</label>
      <input className="fi" value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handle()}} placeholder="Ex: Limpar bancada" autoFocus/>
      <label className="fl">Responsável</label>
      <div className="btng c3">
        <button className={`sbtn ${assign==='g'?'on':''}`} onClick={()=>setAssign('g')}>{firstName(names.g)}</button>
        <button className={`sbtn ${assign==='s'?'on':''}`} onClick={()=>setAssign('s')}>{firstName(names.s)}</button>
        <button className={`sbtn ${!assign?'on':''}`} onClick={()=>setAssign('')}>Rodízio</button>
      </div>
      <label className="fl">Categoria</label>
      <div className="btng c2">{Object.entries(CAT).map(([k,v])=><button key={k} className={`sbtn ${cat===k?'on':''}`} onClick={()=>setCat(k)}>{v}</button>)}</div>
      <label className="fl">Esforço</label>
      <div className="btng c3">
        {(['light','medium','heavy'] as const).map(w=><button key={w} className={`sbtn ${weight===w?'on':''}`} onClick={()=>setWeight(w)}>{w==='light'?'🟢':w==='medium'?'🟡':'🔴'} {WPT[w]}<small>+{XPW[w]} XP</small></button>)}
      </div>
      <label className="fl">Frequência</label>
      <div className="btng c3">{Object.entries(FPT).map(([k,v])=><button key={k} className={`sbtn ${freq===k?'on':''}`} onClick={()=>setFreq(k)}>{v}</button>)}</div>
      {usesDays&&<>
        <label className="fl">Dias da semana <span className="hint">({freq==='daily'?'só nesses dias':'aparece a partir do primeiro dia escolhido'}; nenhum = qualquer dia)</span></label>
        <div className="wdays" role="group" aria-label="Dias da semana">
          {[1,2,3,4,5,6,0].map(d=><button key={d} type="button" className={`wday ${days.includes(d)?'on':''}`} aria-pressed={days.includes(d)} onClick={()=>toggleDay(d)}>{WEEKDAY_SHORT[d]}</button>)}
        </div>
      </>}
      {freq==='once'&&<>
        <label className="fl">Data <span className="hint">(opcional · aparece em Hoje a partir dela)</span></label>
        <input type="date" className="fi" value={due} onChange={e=>setDue(e.target.value)} style={{maxWidth:200}}/>
      </>}
      <label className="fl">Horário <span className="hint">(opcional)</span></label>
      <input type="time" className="fi" value={time} onChange={e=>setTime(e.target.value)} style={{maxWidth:180}}/>
      <label className="fl">Essencial?</label>
      <div className="btng c2">
        <button className={`sbtn ${!ess?'on':''}`} style={{textAlign:'left',padding:'11px 13px'}} onClick={()=>setEss(false)}>Regular<small>Pode ser adiada</small></button>
        <button className={`sbtn ${ess?'on':''}`} style={{textAlign:'left',padding:'11px 13px'}} onClick={()=>setEss(true)}>🔴 Essencial<small>Não pode falhar</small></button>
      </div>
      {casaOk&&<>
        <label className="fl">Prioridade</label>
        <div className="btng c3" role="radiogroup" aria-label="Prioridade">
          {(['alta','normal','baixa'] as const).map(p=><button key={p} role="radio" aria-checked={prio===p} className={`sbtn ${prio===p?'on':''}`} onClick={()=>setPrio(p)}>{p==='alta'?'↑ Alta':p==='normal'?'Normal':'↓ Baixa'}</button>)}
        </div>
        <label className="fl">Checklist <span className="hint">({t?.frequency!=='once'&&freq!=='once'?'volta em branco a cada vez que a tarefa é concluída':'para quebrar em passos'})</span></label>
        <ul className="tk-check">
          {check.map((c,i)=><li key={i}>
            <label><input type="checkbox" checked={c.d} onChange={()=>setCheck(l=>l.map((x,j)=>j===i?{...x,d:!x.d}:x))}/><span className={c.d?'done':''}>{c.t}</span></label>
            <button className="ib" aria-label={`Remover ${c.t}`} onClick={()=>setCheck(l=>l.filter((_,j)=>j!==i))}>✕</button>
          </li>)}
        </ul>
        <div className="tk-add"><input className="fi" value={newItem} maxLength={80} placeholder="Novo item do checklist" aria-label="Novo item do checklist" onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addItem()}}}/><button className="btn btn-g" onClick={addItem} disabled={!newItem.trim()}>+</button></div>
        <label className="fl">Observações</label>
        <textarea className="fita" rows={3} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex.: usar o produto do armário de cima"/>
      </>}
      {editing&&hist&&<>
        <label className="fl">Histórico</label>
        {hist.length===0?<div className="hint">Ainda não foi feita.</div>:<ul className="tk-hist">
          {hist.map((h,i)=><li key={i}><span className="mono">{fmtDate(h.date)}</span>{h.kind==='done'?<>✓ feita{h.by?` por ${firstName(names[h.by])}`:''}</>:h.kind==='skip'?<>⤼ pulada{h.by?` por ${firstName(names[h.by])}`:''}</>:<>⏭ adiada{h.by?` por ${firstName(names[h.by])}`:''}</>}</li>)}
        </ul>}
      </>}
    </Sheet>
  )
}

function SuggModal({tasks,onClose,onAdd,onCustomize}:{tasks:Task[],onClose:()=>void,onAdd:(sel:any[])=>Promise<void>,onCustomize:(s:any)=>void}){
  const cats=Object.keys(SUGG)
  const[curTab,setCurTab]=useState(cats[0])
  const[sel,setSel]=useState<any[]>([])
  const[busy,setBusy]=useState(false)
  const existing=new Set(tasks.map(t=>t.title))
  const keyOf=(s:any)=>curTab+'::'+s.t
  function toggle(s:any){const key=keyOf(s);setSel(p=>p.find(x=>x.key===key)?p.filter(x=>x.key!==key):[...p,{...s,key}])}
  function selectAll(){const toAdd=SUGG[curTab].filter(s=>!existing.has(s.t)&&!sel.find(x=>x.key===keyOf(s)));setSel(p=>[...p,...toAdd.map(s=>({...s,key:keyOf(s)}))])}
  return(
    <Sheet size="lg" title="Sugestões de tarefas" onClose={onClose} footer={
      <button className="btn btn-p" disabled={sel.length===0||busy} onClick={async()=>{setBusy(true);try{await onAdd(sel)}finally{setBusy(false)}}}>
        {busy?'Salvando…':sel.length===0?'Selecione tarefas':`Adicionar ${sel.length} tarefa${sel.length!==1?'s':''}`}
      </button>
    }>
      <div className="stabs">{cats.map(c=>{
        const n=sel.filter(x=>x.key.startsWith(c+'::')).length
        return <button key={c} className={`fc ${curTab===c?'on':''}`} onClick={()=>setCurTab(c)}>{c}{n>0&&` · ${n}`}</button>
      })}</div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontSize:12,color:'var(--sub)'}}>Toque para selecionar · ✎ para ajustar antes</span>
        <button onClick={selectAll} style={{fontSize:12.5,fontWeight:500,color:'var(--green)',background:'none',border:'none'}}>Selecionar todas</button>
      </div>
      {SUGG[curTab].map(s=>{
        const on=!!sel.find(x=>x.key===keyOf(s));const added=existing.has(s.t)
        return(
          <div key={s.t} className={`li ${on?'on':''} ${added?'off':''}`} onClick={()=>!added&&toggle(s)}>
            <span className={`chk ${on||added?'ok':''}`}>✓</span>
            <span className="li-t">{s.t}</span>
            <div className="li-m">
              {added?<span className="bdg bdg-n">já existe</span>:<>
                {s.ess&&<span className="bdg bdg-e">essencial</span>}
                <span className={`bdg bdg-${wCls(s.w)}`}>{WPT[s.w]}</span>
                <span className="bdg bdg-n">{FPT[s.f]}</span>
                <button className="ib" style={{width:28,height:28}} title="Ajustar antes de criar" onClick={e=>{e.stopPropagation();onCustomize(s)}}>✎</button>
              </>}
            </div>
          </div>
        )
      })}
    </Sheet>
  )
}

function PetModal({saving,onClose,onSave}:{saving:boolean,onClose:()=>void,onSave:(d:any,r:any[])=>void}){
  const[pname,setPname]=useState('')
  const[breed,setBreed]=useState('')
  const[isPuppy,setIsPuppy]=useState(false)
  const[sel,setSel]=useState<string[]>(DR_DEF.map(r=>r.t))
  const allR=[...DR_DEF,...(isPuppy?DR_PUP:[])]
  const toggle=(t:string)=>setSel(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t])
  function pickPuppy(v:boolean){setIsPuppy(v);if(v)setSel(p=>Array.from(new Set([...p,...DR_PUP.map(r=>r.t)])))}
  const handle=()=>{if(!pname.trim()||saving)return;onSave({name:pname.trim(),breed:breed.trim()||null,is_puppy:isPuppy},allR.filter(r=>sel.includes(r.t)).map(r=>({title:r.t,frequency:r.f,scheduled_time:r.time})))}
  return(
    <Sheet title="Cadastrar pet" onClose={onClose} footer={<button className="btn btn-p" disabled={!pname.trim()||saving} onClick={handle}>{saving?'Salvando…':'Adicionar pet'}</button>}>
      <label className="fl">Nome</label><input className="fi" value={pname} onChange={e=>setPname(e.target.value)} placeholder="Ex: Luna, Bob..." autoFocus/>
      <label className="fl">Raça <span className="hint">(opcional)</span></label><input className="fi" value={breed} onChange={e=>setBreed(e.target.value)} placeholder="Ex: Golden Retriever, SRD..."/>
      <label className="fl">Fase</label>
      <div className="btng c2"><button className={`sbtn ${!isPuppy?'on':''}`} onClick={()=>pickPuppy(false)}>🐕 Adulto</button><button className={`sbtn ${isPuppy?'on':''}`} onClick={()=>pickPuppy(true)}>🐶 Filhote</button></div>
      <label className="fl">Rotinas <span className="hint">({allR.filter(r=>sel.includes(r.t)).length} selecionadas)</span></label>
      {allR.map(r=>{const on=sel.includes(r.t);return(
        <div key={r.t} className={`li ${on?'on':''}`} onClick={()=>toggle(r.t)}>
          <span className={`chk ${on?'ok':''}`}>✓</span>
          <span className="li-t">{r.t}</span>
          <div className="li-m">{r.time&&<span className="bdg bdg-t">{r.time}</span>}<span className="bdg bdg-n">{r.f==='daily'?'diária':'semanal'}</span></div>
        </div>
      )})}
    </Sheet>
  )
}

function DogModal({dog,saving,onClose,onSave,onDelete}:{dog:Dog,saving:boolean,onClose:()=>void,onSave:(id:string,d:any)=>void,onDelete:(d:Dog)=>void}){
  const[pname,setPname]=useState(dog.name)
  const[breed,setBreed]=useState(dog.breed||'')
  const[isPuppy,setIsPuppy]=useState(dog.is_puppy)
  const handle=()=>{if(!pname.trim()||saving)return;onSave(dog.id,{name:pname.trim(),breed:breed.trim()||null,is_puppy:isPuppy})}
  return(
    <Sheet title={`Editar ${dog.name}`} onClose={onClose} footer={<>
      <button className="btn btn-danger" disabled={saving} onClick={()=>onDelete(dog)}>Remover</button>
      <button className="btn btn-p" disabled={!pname.trim()||saving} onClick={handle}>{saving?'Salvando…':'Salvar alterações'}</button>
    </>}>
      <label className="fl">Nome</label><input className="fi" value={pname} onChange={e=>setPname(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handle()}}/>
      <label className="fl">Raça <span className="hint">(opcional)</span></label><input className="fi" value={breed} onChange={e=>setBreed(e.target.value)} placeholder="Ex: Golden Retriever, SRD..."/>
      <label className="fl">Fase</label>
      <div className="btng c2"><button className={`sbtn ${!isPuppy?'on':''}`} onClick={()=>setIsPuppy(false)}>🐕 Adulto</button><button className={`sbtn ${isPuppy?'on':''}`} onClick={()=>setIsPuppy(true)}>🐶 Filhote<small>Ativa o registro de acidentes</small></button></div>
    </Sheet>
  )
}

function RoutineModal({routine,dogName,saving,onClose,onSave,onDelete}:{routine:DogRoutine|null,dogName:string,saving:boolean,onClose:()=>void,onSave:(d:any,id?:string)=>void,onDelete:(r:DogRoutine)=>void}){
  const[title,setTitle]=useState(routine?.title||'')
  const[freq,setFreq]=useState(routine?.frequency||'daily')
  const[time,setTime]=useState(hhmm(routine?.scheduled_time||null))
  const handle=()=>{if(!title.trim()||saving)return;onSave({title:title.trim(),frequency:freq,scheduled_time:time||null},routine?.id)}
  return(
    <Sheet size="sm" title={routine?`Editar rotina · ${dogName}`:`Nova rotina · ${dogName}`} onClose={onClose} footer={<>
      {routine&&<button className="btn btn-danger" disabled={saving} onClick={()=>onDelete(routine)}>Remover</button>}
      <button className="btn btn-p" disabled={!title.trim()||saving} onClick={handle}>{saving?'Salvando…':routine?'Salvar':'Criar rotina'}</button>
    </>}>
      <label className="fl">Nome</label>
      <input className="fi" value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handle()}} placeholder="Ex: Remédio de verme" autoFocus={!routine}/>
      <label className="fl">Frequência</label>
      <div className="btng c2">{RFREQ.map(([k,v])=><button key={k} className={`sbtn ${freq===k?'on':''}`} onClick={()=>setFreq(k)}>{v}</button>)}</div>
      <label className="fl">Horário <span className="hint">(opcional)</span></label>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input type="time" className="fi" value={time} onChange={e=>setTime(e.target.value)} style={{maxWidth:180}}/>
        {time&&<button className="btn btn-g" onClick={()=>setTime('')}>Sem horário</button>}
      </div>
    </Sheet>
  )
}

function EnergyModal({energy,onClose,onPick}:{energy:string,onClose:()=>void,onPick:(e:'high'|'medium'|'low')=>void}){
  return(
    <Sheet size="sm" title="Energia da semana" onClose={onClose}>
      <div style={{fontSize:13,color:'var(--sub)',marginBottom:14}}>Como vocês chegam nessa semana?</div>
      <div className="btng" style={{gap:8}}>
        {(['high','medium','low'] as const).map(v=>(
          <button key={v} className={`sbtn ${energy===v?'on':''}`} style={{padding:14,textAlign:'left',fontSize:14}} onClick={()=>onPick(v)}>
            {ENERGY[v].ic} {ENERGY[v].l}<small>{ENERGY[v].s}</small>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function MeetingModal({householdId,names,weekStart,saving,onClose,onSave}:{householdId:string,names:Names,weekStart:string,saving:boolean,onClose:()=>void,onSave:(m:Meeting)=>void}){
  const[form,setForm]=useState<Meeting>({what_worked:'',what_overloaded:'',adjustments:'',priorities:'',mood_g:'ok',mood_s:'ok',wins:'',next_mode:'normal',reward:''})
  const[ai,setAi]=useState<{state:'idle'|'busy'|'ok'|'err',tips?:string[],error?:string}>({state:'idle'})
  async function askAi(){setAi({state:'busy'});const r=await fetchAiTips(householdId);setAi(r.tips?{state:'ok',tips:r.tips}:{state:'err',error:r.error})}
  const useTip=(t:string)=>setForm(p=>({...p,adjustments:p.adjustments?`${p.adjustments}\n${t}`:t}))
  const set=(k:keyof Meeting,v:string)=>setForm(p=>({...p,[k]:v}))
  const moods=[['😌 Bem','ok'],['😐 Ok','mid'],['😔 Difícil','hard']]
  const modes=[['🌿 Normal','normal'],['⚡ Boss Mode','boss'],['🛡 Sobrevivência','survival']]
  const area=(n:string,k:keyof Meeting,label:string,ph:string)=>(
    <div className="meet"><label className="fl">{n} — {label}</label><textarea className="fita" value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={ph}/></div>
  )
  return(
    <Sheet size="lg" title="📋 Reunião semanal" onClose={onClose} footer={<button className="btn btn-p" disabled={saving} onClick={()=>onSave(form)}>{saving?'Salvando…':'Salvar reunião'}</button>}>
      <div style={{fontSize:13,color:'var(--sub)',marginBottom:14}}>Semana de {fmtDate(weekStart)} · 15 minutos · sem cobranças</div>
      <div className="aibox">
        {ai.state==='idle'&&<button className="btn btn-pur btn-w" onClick={askAi}>✦ Sugestões da IA para a semana</button>}
        {ai.state==='busy'&&<div className="ai-wait" role="status"><span className="spin" aria-hidden="true"/>A IA está lendo a semana de vocês…</div>}
        {ai.state==='err'&&<div className="inline-err">{ai.error} <button className="lnk" onClick={askAi}>Tentar de novo</button></div>}
        {ai.state==='ok'&&<>
          <div className="slbl">✦ Sugestões da IA</div>
          {ai.tips!.map((t,i)=><div key={i} className="ai-tip"><span>{t}</span><button className="lnk" onClick={()=>useTip(t)} title="Copiar para o ajuste da semana">+ usar</button></div>)}
          <div className="row-s" style={{marginTop:6}}>Sugestões, não regras. “+ usar” copia para o item 03.</div>
        </>}
      </div>
      {area('01','what_worked','O que funcionou essa semana?','Tarefas que rolaram bem, hábitos que mantiveram...')}
      {area('02','what_overloaded','O que sobrecarregou?','O que pesou demais, o que ficou acumulando...')}
      {area('03','adjustments','Ajuste para próxima semana','Uma mudança pequena e concreta...')}
      {area('04','priorities','Prioridades da semana','3 coisas mais importantes...')}
      <div className="meet">
        <label className="fl">05 — Como cada uma chega?</label>
        {(['g','s'] as Who[]).map(w=>(
          <div key={w} style={{marginBottom:w==='g'?12:0}}>
            <div style={{fontSize:12.5,color:'var(--sub)',marginBottom:6}}>{names[w]}</div>
            <div className="btng c3">{moods.map(([l,v])=><button key={v} className={`sbtn ${form[w==='g'?'mood_g':'mood_s']===v?'on':''}`} onClick={()=>set(w==='g'?'mood_g':'mood_s',v)}>{l}</button>)}</div>
          </div>
        ))}
      </div>
      {area('06','wins','Pequenas vitórias 🎉','Qualquer coisa que valha celebrar...')}
      <div className="meet">
        <label className="fl">07 — Modo da próxima semana</label>
        <div className="btng c3">{modes.map(([l,v])=><button key={v} className={`sbtn ${form.next_mode===v?'on':''}`} onClick={()=>set('next_mode',v)}>{l}</button>)}</div>
      </div>
      <div className="meet">
        <label className="fl">08 — Recompensa do casal <span className="hint">(se merecer)</span></label>
        <input className="fi" value={form.reward} onChange={e=>set('reward',e.target.value)} placeholder="Ex: jantar fora, noite de filme, delivery..."/>
      </div>
    </Sheet>
  )
}

// ── APP ─────────────────────────────────────────────────
type ToastState={kind:'ok'|'err',msg:string,undo?:()=>void,retry?:()=>void}

export interface Account { who:Who, email:string, onSignOut:()=>void }

export default function NinhoApp({householdId,account}:{householdId:string,account?:Account}){
  const [screen,setScreenState]=useState<ScreenId>('inicio')
  const [casaView,setCasaView]=useState<CasaView>('tarefas')
  const [rotView,setRotView]=useState<'rotinas'|'habitos'|'meu'>('rotinas')
  const [theme,setThemeState]=useState<ThemeId>('aconchego')
  useEffect(()=>{setThemeState(readTheme(null,typeof matchMedia!=='undefined'&&matchMedia('(prefers-color-scheme: dark)').matches))},[])
  function pickTheme(t:ThemeId){saveTheme(t);applyTheme(t);setThemeState(t)}
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
  const cz=useCaes(householdId,today)
  const md=useMeuDia(householdId,today)
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
  async function save(context:string,fn:()=>Promise<void>,okMsg:string){
    if(saving)return
    setSaving(true)
    try{await fn();closeModal();showToast(okMsg)}
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

  async function addSuggestions(sel:any[]){
    const existing=new Set(tasks.map(t=>t.title))
    const toAdd=sel.filter(s=>!existing.has(s.t)).map(s=>({title:s.t,category:s.cat,weight:s.w,frequency:s.f,assigned_to:null,scheduled_time:null,essential:s.ess}))
    if(!toAdd.length){closeModal();return}
    try{
      await api.insertTasks(householdId,toAdd as any)
      await data.reloadTasks()
      closeModal();showToast(`${toAdd.length} tarefa${toAdd.length!==1?'s':''} adicionada${toAdd.length!==1?'s':''}!`)
    }catch(e){showError(toNinhoError(e,'adicionar sugestões'))}
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

  function saveBet(bet:string){
    save('salvar aposta',async()=>{await api.saveBet(householdId,weekStart,bet);setSettings(p=>({...p,bet}))},'Aposta da semana salva!')
  }

  function saveMeeting(m:Meeting){
    save('salvar reunião',async()=>{await api.saveMeeting(householdId,weekStart,m);if(screen==='nos')await loadHistory()},'Reunião salva!')
  }

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
  const plan=planToday(tasks,dogs,today,{focus:focusMode&&!showAllToday,split:casa.split})
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
  const helpReq=tasks.filter(t=>t.help_by&&t.help_by!==me&&!t.completed_today)
  const countFor=(w:Who)=>{const all=hItems.filter(i=>ownerOfItem(i)===w);return{all:all.length,done:all.filter(i=>i.completed_today).length}}
  // Início: semana real, rotina do momento, resumo de agora, cuidados dos cães, desafio sugerido
  const weekInfo=weekDays(weekStart,today,{tasks,dogs,checkins:week.checkins,days:week.days,survivalNow:settings.survival})
  const rn=routineNow(routines.filter(r=>routineOnDay(r,today)),today,nowHM)
  const rnRun=(r:Routine|null)=>r?runProgress(r,rot.runs.find(x=>x.routine_id===r.id&&x.date===today),settings.survival):null
  const nowSum=nowSummary(hItems,me,ownerOfItem,nowHM)
  const care=dogCare(casa.maint,today)
  const challenge=(setup?.answers as any)?.challenge as {title:string,days:number,why:string}|undefined
  const itemTitle=(i:HItem)=>i.task?i.task.title:i.dog!.title
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

  // ── AÇÕES RÁPIDAS (botão + no celular, "Ação rápida" no menu lateral) ──
  const quickActions:QuickAction[]=[
    {id:'task',icon:'tarefa',label:'Nova tarefa',sub:'Algo com começo e fim',run:()=>openModal('task',null)},
    {id:'shop',icon:'compra',label:'Adicionar compra',sub:'Na lista do mercado',run:()=>{goCasa('compras');setTimeout(()=>(document.querySelector('.shop-add input') as HTMLInputElement|null)?.focus(),250)}},
    ...(sp.available?[{id:'sprint',icon:'sprint',label:'Sprint do Ninho',sub:sp.active?`Em andamento · ${fmtClock(remainingMs(sp.active,sp.now))}`:'Mutirão de 10, 15 ou 25 min',run:()=>setSprintOpen(true)}]:[]),
    {id:'routine',icon:'rotinas',label:'Iniciar rotina',sub:rn.now?rn.now.title:rn.next?`Próxima: ${rn.next.title}`:'Ver as rotinas',run:()=>go('rotinas')},
    ...(md.available&&me?[{id:'meudia',icon:'agua',label:'Meu dia',sub:'Água, sono, remédios e treino',run:()=>{go('rotinas');setRotView('meu')}}]:[]),
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
          </div>
        </div>
        {canEarnOnTime(it,nowHM)
          ?<span className="xp xp-l bonus" title={`Até ${hhmm(it.scheduled_time)}: XP ×1,5`}>+{xpWithBonus(1,true)*it.parts.length}⚡</span>
          :<span className="xp xp-l">+{it.parts.length}</span>}
      </div>
    )
  }
  const itemRow=(i:HItem,o:{actions?:boolean,next?:boolean}={})=>i.task?taskRow(i.task,o):dogItemRow(i.dog!,o)

  const personCard=(who:Who)=>{
    const all=hItems.filter(i=>ownerOfItem(i)===who)
    const pend=all.filter(i=>!i.completed_today)
    const done=all.filter(i=>i.completed_today)
    const pct=all.length?Math.round(done.length/all.length*100):0
    const doneXP=done.reduce((s,i)=>s+xpOfItem(i),0)
    const essLeft=pend.filter(i=>i.essential).length
    return(
      <section key={who} className="card pcard" data-hide={person!==who?'1':'0'}>
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
            <div><button className="btn btn-s" onClick={()=>openModal('sugg')}>✦ Ver sugestões</button></div>
          </div>
        )):<>
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

  return(
    <>

      <SideNav current={screen} onGo={go} onQuick={()=>openModal('quick')}
        profile={{initials:initials(names[me||'g']),name:me?firstName(names[me]):'Ninho',sub:account?.email||'Perfil e ajustes',cls:`av-${me||'g'}`}}/>
      <div className="app-main">
      {/* CABEÇALHO */}
      <header className="top">
        <div className="top-in">
          <button className="logo mob-only" onClick={()=>go('inicio')} aria-label="Ninho, ir para o Início">Ni<span>nho</span></button>
          <div className="status">
            <button className={`chip ${en.cls}`} onClick={()=>openModal('energy')} title="Energia da semana">{en.ic} <span className="chip-hide">{en.short}</span></button>
            {settings.survival&&<button className="chip coral" onClick={toggleSurvival} title="Modo sobrevivência ativo">🛡</button>}
            <span className="chip chip-hide">Nv{lv.l} · {xp} XP</span>
            <span className="chip amber" title={`${streak} dias seguidos`}>🔥 {streak}</span>
            <button className={`av av-${me||'g'} top-prof mob-only`} onClick={()=>go('ajustes')} aria-label="Perfil e ajustes">{initials(names[me||'g'])}</button>
          </div>
        </div>
      </header>

      <main className="main">
        {sp.active&&!sprintOpen&&<button className="sp-banner" onClick={()=>setSprintOpen(true)} aria-label="Voltar para o sprint em andamento">
          <span aria-hidden="true">⏱</span><span><b>Sprint · {sp.active.goal||areaLabel(sp.active.area)}</b> <span className="mono">{remainingMs(sp.active,sp.now)===0?'tempo esgotado':`${fmtClock(remainingMs(sp.active,sp.now))}${sp.active.paused_at?' · pausado':''}`}</span></span><span className="sp-banner-go">Voltar ›</span>
        </button>}
        {data.status==='loading'&&<div className="loadscr" role="status" aria-live="polite"><span className="spin" aria-hidden="true"/>Carregando a casa…</div>}
        {data.status==='error'&&<div className="card loaderr" role="alert">
          <div style={{fontSize:16,fontWeight:500,marginBottom:6}}>Não foi possível carregar o Ninho</div>
          <div style={{fontSize:13,color:'var(--sub)',marginBottom:14}}>{data.loadError?.userMessage}</div>
          <button className="btn btn-p" onClick={()=>data.loadAll()}>Tentar novamente</button>
        </div>}
        {data.status==='ready'&&data.offline&&<div className="banner low" role="status">📴 <span>Sem internet. Mostrando os dados de {timeOfInstant(data.offline.savedAt)}. Marcar e editar voltam quando a conexão voltar.</span>
          <button className="lnk" onClick={()=>data.loadAll()}>Tentar agora</button></div>}
        {data.status==='ready'&&<>
        {/* ── HOJE ── */}
        {screen==='inicio'&&<div className="scr">
          <div className="sh">
            <div><h1>{hello}{me?`, ${firstName(names[me])}`:''} 👋</h1><p>{dateLabel}</p>
              <div className="hd-chips">
                {me&&<span className="chip"><span className={`mini av-${me}`} aria-hidden="true">{names[me].slice(0,1).toUpperCase()}</span>{account?'Sua conta':'Este aparelho'}</span>}
                <button className={`chip ${en.cls}`} onClick={()=>openModal('energy')} aria-label={`Energia da semana: ${en.l}. Alterar`}>{en.ic} {en.l}</button>
                <button className={`chip ${settings.survival?'coral':''}`} onClick={toggleSurvival} aria-label={settings.survival?'Modo sobrevivência ativo. Desativar':'Modo normal. Ativar modo sobrevivência'}>{settings.survival?'🛡 Modo sobrevivência':'Modo normal'}</button>
              </div>
            </div>
            <div className="sh-a desk-only"><button className="btn btn-p" onClick={()=>openModal('task',null)}>+ Nova tarefa</button></div>
          </div>
          {setup?.available&&!setup.completed&&!onb&&<div className="setup-cta">
            <span aria-hidden="true" style={{fontSize:24}}>🪺</span>
            <div><b>Configurar o Ninho</b><small>{(setup.progress?.step||1)>1?`Você parou na etapa ${setup.progress!.step} de ${LAST_STEP}. As respostas estão guardadas.`:'Uns 3 minutos para ajustar rotinas, essenciais e a aparência.'}</small></div>
            <button className="btn btn-p" onClick={()=>setOnb('open')}>{(setup.progress?.step||1)>1?'Continuar':'Começar'}</button>
          </div>}

          <div className="stats">
            <div className="stat">
              <div className="stat-l">Hoje</div>
              <div className="stat-v">{dayPct}%<small>{doneToday}/{allToday.length}</small></div>
              <div className="bar"><div className="barf" style={{width:dayPct+'%',background:'var(--gdk)'}}/></div>
            </div>
            <div className="stat">
              <div className="stat-l">Casa</div>
              <div className="stat-v stat-txt" style={{color:ci.color}}>{ci.label}</div>
              <div className="bar"><div className="barf" style={{width:chaos+'%',background:ci.color}}/></div>
            </div>
            <button className="stat" onClick={()=>setTab('week')}>
              <div className="stat-l">Nível {lv.l}<span className="lg-only"> · {lv.n}</span></div>
              <div className="stat-v">{xp}<small>/ {lv.max} XP</small></div>
              <div className="bar"><div className="barf" style={{width:xpPct+'%',background:'var(--pur)'}}/></div>
            </button>
            <div className="stat">
              <div className="stat-l">Sequência do casal{game.streaks.house_best>0&&<span className="lg-only"> · recorde {game.streaks.house_best}</span>}</div>
              <div className="stat-v">🔥 {streak}<small>dia{streak!==1?'s':''}</small></div>
              <div className="week-dots">{weekDots(todayIndex,streak,doneToday>0).map((c,i)=><div key={i} className={`wd ${c}`}/>)}</div>
            </div>
            <button className="stat stat-ch" onClick={()=>challenge?go('nos'):setOnb(setup?.completed?'redo':'open')}>
              <div className="stat-l">Desafio{challenge?' sugerido':''}</div>
              <div className="stat-v stat-txt">{challenge?challenge.title:'Nenhum ainda'}</div>
              <div className="stat-s">{challenge?`${challenge.days} dias, as duas juntas`:setup?.available?'Sugerido na configuração':'Em breve'}</div>
            </button>
          </div>

          {week.available&&<WeekStrip days={weekInfo} names={names}/>}

          {settings.survival?(
            <div className="banner surv">🛡 <span>Modo sobrevivência — {showAllToday?'mostrando todas as tarefas':`só essenciais${hiddenCount>0?` · ${hiddenCount} ocultas`:''}`}</span>
              <button className="lnk" onClick={()=>setShowAllToday(v=>!v)}>{showAllToday?'Só essenciais':'Mostrar todas'}</button>
              <button className="lnk" style={{marginLeft:0}} onClick={toggleSurvival}>Desativar</button>
            </div>
          ):settings.energy==='low'&&(
            <div className="banner low">🌧 <span>Semana de baixa energia — {showAllToday?'mostrando todas':`foco no essencial${hiddenCount>0?` · ${hiddenCount} ocultas`:''}`}</span>
              <button className="lnk" onClick={()=>setShowAllToday(v=>!v)}>{showAllToday?'Só essenciais':'Mostrar todas'}</button>
            </div>
          )}

          <div className="now-h">
            <h2>Para agora</h2>
            <div className="now-s" aria-live="polite">
              {nowSum.late>0&&<span className="chip coral">⚠ {nowSum.late} atrasada{nowSum.late>1?'s':''}</span>}
              {nowSum.essentials>0&&<span className="chip">● {nowSum.essentials} essencia{nowSum.essentials>1?'is':'l'} pendente{nowSum.essentials>1?'s':''}</span>}
              {nowSum.next&&<span className="chip">▸ {itemTitle(nowSum.next)} às {hhmm(nowSum.next.scheduled_time)}</span>}
              {helpReq.length>0&&<button className="chip tag-help" onClick={()=>openModal('taskmenu',helpReq[0])}>🙋 {firstName(names[helpReq[0].help_by!])} pediu ajuda: {helpReq[0].title}{helpReq.length>1?` +${helpReq.length-1}`:''}</button>}
              {!nowSum.late&&!nowSum.essentials&&!nowSum.next&&!helpReq.length&&<span className="chip green">✓ Nada urgente{me?' para você':''}</span>}
            </div>
          </div>
          <div className="today">
            <div className="seg" style={{gridColumn:'1/-1'}}>
              {(['g','s'] as Who[]).map(w=>{const c=countFor(w);return(
                <button key={w} className={`segb ${person===w?'on':''}`} onClick={()=>pickPerson(w)}>
                  <span className="d" style={{background:w==='g'?'var(--green)':'var(--pur)'}}/>{firstName(names[w])}<span className="cnt">{c.done}/{c.all}</span>
                </button>
              )})}
            </div>
            {personCard('g')}
            {personCard('s')}
            <aside className="side">
              {week.available&&me&&<CheckinCard me={me} names={names} today={week.checkins.filter(c=>c.date===today)} onSave={saveCheckin}/>}
              {md.available&&me&&<MeuDiaCard me={me} settings={md.settings} logs={md.logs} meds={md.meds} today={today} nowHM={nowHM}
                onAdd={(k,v)=>{md.add(me,k,v).then(()=>showToast('+1 copo 💧')).catch(e=>showError(toNinhoError(e,'registrar água')))}} onOpen={()=>{go('rotinas');setRotView('meu')}}/>}
              {setup?.available&&<RoutineNowCard now={rn.now} next={rn.next} countToday={rn.today.length} names={names}
                turnOf={r=>turnBy('routine:'+r.id,'daily',today,plan.slots)} progress={r=>rnRun(r as Routine)} onOpen={()=>go('rotinas')} onSetup={()=>setOnb(setup.completed?'redo':'open')}/>}
              <div className="card">
                <div className="slbl">🐾 Cães hoje {dogDaily.length>0&&<span className="mono" style={{color:'var(--faint)'}}>{dogDone}/{dogDaily.length}</span>}<button className="lnk" onClick={()=>setTab('pets')}>Ver →</button></div>
                {dogs.length===0?(
                  <div className="empty" style={{padding:'12px 0'}}>Nenhum pet ainda<div><button className="btn btn-s" onClick={()=>openModal('pet')}>+ Cadastrar pet</button></div></div>
                ):dogs.map(dog=>{
                  // Resumo: as rotinas em si já estão na lista de quem é a vez
                  const due=dog.routines.filter(r=>dueToday(r,today))
                  const dn=due.filter(r=>r.completed_today).length
                  const nxt=due.filter(r=>!r.completed_today).sort(byTime)[0]
                  const acc=dog.is_puppy?accidents.filter(a=>a.dog_id===dog.id&&a.date===today).length:0
                  return(
                    <button key={dog.id} className="dsum" onClick={()=>setTab('pets')}>
                      <span className="dav" style={{width:36,height:36,fontSize:18}}>{dog.is_puppy?'🐶':'🐕'}</span>
                      <span style={{flex:1,minWidth:0}}>
                        <span className="dsum-h"><span><b>{dog.name}</b>{dog.is_puppy&&<span className="accb" title="Acidentes hoje">💧 {acc}</span>}</span><span className="mono">{dn}/{due.length}</span></span>
                        <span className="bar" style={{marginTop:6,display:'block'}}><span className="barf" style={{display:'block',width:(due.length?dn/due.length*100:100)+'%',background:'var(--gdk)'}}/></span>
                        <span className="dsum-s">{nxt?<>Próxima: {nxt.title}{nxt.scheduled_time&&<span className={isLate(nxt,nowHM)?'late':''}> · {hhmm(nxt.scheduled_time)}</span>}</>:due.length?'✓ Tudo feito hoje':'Sem rotinas hoje'}</span>
                      </span>
                    </button>
                  )
                })}
                {(care.length>0||healthSoon.some(r=>r.next_date!<=addDays(today,14)))&&<div className="care">
                  <div className="care-l">Cuidados próximos</div>
                  {healthSoon.filter(r=>r.next_date!<=addDays(today,14)).slice(0,4).map(r=><button key={r.id} className="care-i" onClick={()=>go('caes')}><span>{kindInfo(r.kind)[1]} {dogName(r.dog_id)}: {r.title}</span><span className={`mono ${r.late?'late':''}`}>{r.late?'atrasado':r.next_date===today?'hoje':fmtDate(r.next_date!)}</span></button>)}
                  {care.slice(0,3).map(c=><button key={c.id} className="care-i" onClick={()=>goCasa('manutencao')}><span>{c.title}</span><span className={`mono ${c.next_due<today?'late':''}`}>{c.next_due<today?'atrasado':c.next_due===today?'hoje':fmtDate(c.next_due)}</span></button>)}
                </div>}
                {dogs.length>0&&<div style={{fontSize:11.5,color:'var(--sub)',marginTop:8}}>As rotinas aparecem na lista de quem é a vez ↻</div>}
              </div>
              {ag.available&&(()=>{const soon=agendaEntries(ag.events,[],today,1).filter(e=>!e.late);const due=agBills(ag.events,today).pending.filter(b=>b.date<=addDays(today,3));return (soon.length>0||due.length>0)&&(
                <div className="card ag-home">
                  <div className="slbl">📅 Agenda<button className="lnk" onClick={()=>goCasa('agenda')}>Ver →</button></div>
                  {soon.map(e=><div key={e.key} className="ag-home-i"><span>{e.icon} {e.title}</span><span className="mono">{e.date===today?'hoje':'amanhã'}{e.time?` ${e.time}`:''}</span></div>)}
                  {due.map(b=><div key={b.id} className={`ag-home-i ${b.date<today?'late':''}`}><span>{kindIcon('vencimento')} {b.title}</span><span className="mono">{b.date<today?'atrasado':b.date===today?'vence hoje':`vence ${fmtDate(b.date)}`}</span></div>)}
                </div>)})()}
              <MaintTodayCard items={casa.maint} today={today} names={names} actions={maintActions} onOpen={()=>goCasa('manutencao')}/>
              {(()=>{const sc=shoppingCounts(casa.shop);return casa.shopState==='ready'&&sc.toBuy>0&&(
                <button className="card dsum shop-sum" onClick={()=>setTab('shop')}>
                  <span className="dav" style={{width:36,height:36,fontSize:18}}>🛒</span>
                  <span style={{flex:1,minWidth:0,textAlign:'left'}}><b>{sc.toBuy} ite{sc.toBuy===1?'m':'ns'} na lista de compras</b>
                    <span className="dsum-s">{casa.shop.filter(i=>!i.checked_at).slice(0,4).map(i=>i.title).join(', ')}{sc.toBuy>4?'…':''}</span></span>
                  <span className="chev">›</span>
                </button>)})()}
              <div className="card">
                <div className="slbl">Atalhos</div>
                <div className="acts">
                  {actionBtn('✦','Distribuir tarefas','Equilibra a carga entre vocês',autoDistribute,'var(--pbg)')}
                  {actionBtn(en.ic,'Energia da semana',en.l,()=>openModal('energy'))}
                  {actionBtn('🛡',settings.survival?'Sair do modo sobrevivência':'Modo sobrevivência',settings.survival?'Ativo · só essenciais':'Só o essencial por um tempo',toggleSurvival,settings.survival?'var(--cbg)':undefined)}
                  {actionBtn('📋','Reunião semanal','15 minutos, sem cobranças',()=>openModal('meeting'))}
                  {sp.available&&actionBtn('⏱','Sprint do Ninho',sp.active?`Em andamento · ${fmtClock(remainingMs(sp.active,sp.now))}`:'Mutirão curto com cronômetro',()=>setSprintOpen(true))}
                </div>
              </div>
            </aside>
          </div>
        </div>}

        {/* ── ROTINAS ── */}
        {screen==='rotinas'&&<div className="scr">
          <div className="sh"><div><h2>Rotinas</h2><p>Rotinas com passos e hábitos para ganhar constância</p></div></div>
          <SubTabs label="Rotinas e hábitos" value={rotView} onChange={v=>setRotView(v)} options={[['rotinas','Minhas rotinas',routines.filter(r=>routineOnDay(r,today)).length],['habitos','Hábitos',rot.habits.length],...(md.available?[['meu','Meu dia'] as ['meu',string]]:[])]}/>
          {rotView==='meu'?(me?<MeuDiaView available={md.available} me={me} names={names} today={today} nowHM={nowHM} settings={md.settings} logs={md.logs} meds={md.meds}
            onAdd={(k,v,d)=>md.add(me,k,v,d).catch(e=>{showError(toNinhoError(e,'registrar'));throw e})}
            onRemove={l=>md.remove(l).catch(e=>{showError(toNinhoError(e,'apagar registro'));throw e})}
            onSaveSettings={x=>mdApi.saveSettings(householdId,me,x).then(md.reload).then(()=>showToast('Salvo')).catch(e=>{showError(toNinhoError(e,'salvar'));throw e})}
            onSaveMed={m=>mdApi.saveMed(householdId,me,m).then(md.reload).then(()=>showToast('Remédio salvo')).catch(e=>{showError(toNinhoError(e,'salvar remédio'));throw e})}
            onStopMed={m=>mdApi.stopMed(m.id).then(md.reload).then(()=>showToast('Remédio encerrado')).catch(e=>{showError(toNinhoError(e,'encerrar remédio'));throw e})}/>
            :<div className="card empty"><span className="empty-icon">💧</span>Escolha quem está usando este aparelho para ver o seu Meu dia.</div>)
          :rotView==='rotinas'?<>
            {!rot.routinesOk&&rot.ready?<div className="card empty"><span className="empty-icon">🔁</span>Rotinas com passos precisam da atualização do banco (migration 014).</div>
            :<>
              {routines.length===0&&rot.ready&&<div className="card intro">
                <div className="intro-t">Rotina é um conjunto de passos num momento do dia</div>
                <div className="row-s">Como “fechar a cozinha”: tem checklist, horário e pode ser dividida ou entrar no rodízio. Comece por um modelo ou crie a sua.</div>
              </div>}
              <RoutinesView routines={routines} runs={rot.runs} checklistOk={rot.checklistOk} today={today} me={me} names={names} survival={settings.survival}
                turnOf={routineTurn} onStep={stepRoutine} onFinish={finishRoutine}
                onEdit={r=>openModal('rtedit',r)} onNew={()=>openModal('rtedit',null)} onTemplates={()=>openModal('rttpl')}
                footer={<>
                  <div className="slbl rt-sec">Cães</div>
            <div className="card">
              <div className="slbl">🐾 Rotinas dos cães <span className="mono" style={{color:'var(--faint)'}}>{routineGroups.length}</span><button className="lnk" onClick={()=>go('caes')}>Editar em Cães →</button></div>
              {routineGroups.length===0?<div className="row-s">Nenhuma rotina ainda.</div>:routineGroups.map(g=>{const w=ownerOfRoutine(g.r);return(
                <div key={g.title+g.time+g.frequency} className="row rt-row">
                  <span className="rt-time mono">{hhmm(g.time)||'—'}</span>
                  <div style={{minWidth:0,flex:1}}><div className="row-t">{g.title}</div><div className="row-s">{g.dogs.join(' e ')} · {(FPT[g.frequency]||g.frequency).toLowerCase()}</div></div>
                  <span className={`mini av-${w}`} title={`Hoje: vez de ${firstName(names[w])}`}>{names[w].slice(0,1).toUpperCase()}</span>
                </div>)})}
            </div>
                  <div className="row-s" style={{textAlign:'center'}}>Tarefas (o que tem começo e fim) ficam em <button className="lnk-inline" onClick={()=>goCasa('tarefas')}>Casa › Tarefas</button>.</div>
                </>}/>
            </>}
          </>:<HabitsView habits={rot.habits} logs={rot.logs} available={rot.checklistOk} today={today} me={me} names={names}
            onToggle={toggleHabit} onEdit={h=>openModal('hbedit',{habit:h})} onNew={()=>openModal('hbedit',{habit:null})}
            onSuggest={sg=>openModal('hbedit',{habit:null,preset:{title:sg.title,owner:sg.owner,weekly_target:sg.weekly_target,weekdays:sg.weekdays}})}/>}
        </div>}

        {/* ── CASA ── */}
        {screen==='casa'&&<div className="scr">
          <SubTabs label="Áreas da Casa" value={casaView} onChange={v=>setCasaView(v)} options={[['tarefas','Tarefas',tasks.length],['compras','Compras',shoppingCounts(casa.shop).toBuy],['manutencao','Manutenção',casa.maint.filter(i=>i.next_due<=today).length],...(ag.available?[['agenda','Agenda',agBills(ag.events,today).overdue+ag.events.filter(e=>e.kind!=='vencimento'&&!e.done_at&&e.date<=today).length] as [CasaView,string,number]]:[])]}/>
          {casaView==='compras'?<ShoppingTab householdId={householdId} me={me} names={names} items={casa.shop} history={casa.shopHistory} state={casa.shopState} error={casa.shopError}
            setItems={casa.setShop} onReload={casa.reloadShopping} extras={casa.shopExtras} requireMe={requireMe} toast={(m,u)=>showToast(m,u)} fail={(e,r)=>showError(e,r)} onFinished={onShoppingFinished}/>
          :casaView==='agenda'?<AgendaView available={ag.available} events={ag.events} maint={casa.maint} dogCare={dogCareAgenda} onOpenDogs={()=>go('caes')} today={today} names={names} sobrouUrl={ag.sobrouUrl}
            onNew={k=>openModal('event',{event:null,kind:k})} onEdit={e=>openModal('event',{event:e,kind:e.kind})} onDone={eventDone} onPaid={billPaid}
            onOpenMaint={()=>goCasa('manutencao')} onSaveSobrou={saveSobrou}/>
          :casaView==='manutencao'?<>
            <div className="sh"><div><h2>Manutenção</h2><p>De tempos em tempos: casa, cães, carro e saúde</p></div></div>
            <MaintenanceSection items={casa.maint} log={casa.maintLog} today={today} names={names} state={casa.maintState} error={casa.maintError} actions={maintActions}
              onReload={()=>{casa.reloadMaintenance()}} onNew={()=>openModal('maint',null)} onEdit={it=>openModal('maint',it)} onTemplates={()=>openModal('mainttpl')}/>
          </>:<>
          <div className="sh">
            <div><h2>Tarefas</h2><p>{tasks.length} ativa{tasks.length!==1?'s':''} · toque numa tarefa para editar</p></div>
            <div className="sh-a">
              <button className="btn btn-s" onClick={()=>openModal('sugg')}>✦ Sugestões</button>
              <button className="btn btn-p" onClick={()=>openModal('task',null)}>+ Nova tarefa</button>
            </div>
          </div>
          <div className="search">
            <span className="search-ic"><Icon name="busca" size={18}/></span>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar tarefa..." aria-label="Buscar tarefa"/>
            {query&&<button className="x" onClick={()=>setQuery('')} aria-label="Limpar busca">✕</button>}
          </div>
          {dogTasks.length>0&&<div className="dupe">
            <span>🐾 {dogTasks.length} tarefa{dogTasks.length!==1?'s':''} de cães repete{dogTasks.length===1?'':'m'} as rotinas da aba Cães — por isso não aparece{dogTasks.length===1?'':'m'} em Hoje.</span>
            <button className="btn btn-pur" onClick={()=>archiveTasks(dogTasks)}>Arquivar</button>
          </div>}
          <div className="fbar">
            <div className="fchips" role="group" aria-label="Filtrar por pessoa ou situação">
              {[['all',`Todas · ${tasks.length}`],['essential','🔴 Essenciais'],['g',firstName(names.g)],['s',firstName(names.s)],['r','Rodízio'],['notime','⏰ Sem horário'],...(casaOk?[['alta','↑ Alta prioridade'],['help','🙋 Pedidos de ajuda']]:[])].map(([k,v])=>(
                <button key={k} className={`fc ${taskFilter===k?'on':''}`} aria-pressed={taskFilter===k} onClick={()=>setTaskFilter(k)}>{v}</button>
              ))}
            </div>
            {usedCats.length>1&&<div className="fchips" role="group" aria-label="Filtrar por cômodo">
              <span className="fchips-l">Cômodo</span>
              {usedCats.map(k=>(
                <button key={k} className={`fc ${taskFilter===k?'on':''}`} aria-pressed={taskFilter===k} onClick={()=>setTaskFilter(taskFilter===k?'all':k)}>{CAT[k]}</button>
              ))}
            </div>}
          </div>
          {tasks.length===0?(
            <div className="card empty"><span className="empty-icon">📋</span>Nenhuma tarefa cadastrada ainda<div><button className="btn btn-p" onClick={()=>openModal('sugg')}>✦ Começar com sugestões</button></div></div>
          ):filtered.length===0?(
            <div className="empty"><span className="empty-icon">🔍</span>Nada encontrado com esse filtro<div><button className="btn btn-g" onClick={()=>{setTaskFilter('all');setQuery('')}}>Limpar filtros</button></div></div>
          ):byCat(filtered).map(([cat,list])=>(
            <div key={cat} className="tgrp">
              <div className="cdiv">{CAT[cat]||cat}<span className="n">{list.length}</span></div>
              <div className="tlist">
                {list.map(t=>(
                  <div key={t.id} className="tc">
                    <span className={`wdot w-${wCls(t.weight)}`} title={WPT[t.weight]}/>
                    <div className="tc-info" onClick={()=>openModal('task',t)}>
                      <div className="tc-title">{t.title}</div>
                      <div className="tc-meta">
                        <button className={`bdg qb ${t.essential?'bdg-e':'bdg-n'}`} onClick={e=>{e.stopPropagation();quickUpdate(t.id,{essential:!t.essential})}} title={t.essential?'Tirar de essencial':'Marcar como essencial'} aria-pressed={t.essential}>{t.essential?'● essencial':'○ essencial'}</button>
                        <QuickTime value={hhmm(t.scheduled_time)} onSave={v=>quickUpdate(t.id,{scheduled_time:v||null})}/>
                        {weekdaysLabel(t.weekdays)&&t.frequency!=='monthly'&&t.frequency!=='once'&&<span className="bdg bdg-t" title="Dias da semana">📆 {weekdaysLabel(t.weekdays)}</span>}
                        {t.frequency==='once'&&t.due_date&&<span className={`bdg ${t.due_date<today?'bdg-h':'bdg-t'}`} title="Data">📆 {fmtDate(t.due_date)}</span>}
                        {pausedToday(t,today)&&<span className="bdg bdg-n">⏸ {t.skip!.kind==='snooze'?'amanhã':'pulada'}</span>}
                        <span className={`bdg bdg-${wCls(t.weight)}`} title={`Esforço ${WPT[t.weight].toLowerCase()} · +${XPW[t.weight]} XP`}>+{XPW[t.weight]}</span>
                        {t.priority==='alta'&&<span className="bdg bdg-h">↑ alta</span>}
                        {t.priority==='baixa'&&<span className="bdg bdg-n">↓ baixa</span>}
                        {!!t.checklist?.length&&<span className="bdg bdg-t">☑ {t.checklist.filter(c=>c.d).length}/{t.checklist.length}</span>}
                        {t.notes&&<span className="bdg bdg-n" title={t.notes}>📝 obs.</span>}
                        {t.help_by&&<span className="bdg bdg-help">🙋 {firstName(names[t.help_by])} pediu ajuda</span>}
                        {!isFixed(t)&&<span className="bdg" style={{background:'var(--pbg)',color:'var(--pur)'}}>↻ {firstName(names[ownerOfTask(t)])}</span>}
                        {t.frequency==='daily'?null:doneInPeriod(t,today)
                          ?<span className="bdg bdg-l">✓ {FPT[t.frequency]} · {lastLabel(lastDone(t,today),today)}</span>
                          :<span className="bdg bdg-n">{FPT[t.frequency]}{t.frequency!=='once'&&` · ${lastLabel(t.prev_done||null,today)}`}</span>}
                      </div>
                    </div>
                    <div className="asg" role="group" aria-label="Responsável">
                      <button className={t.assigned_to==='g'?'on-g':''} onClick={()=>assignTask(t.id,'g')} title={firstName(names.g)}><span className="lg-only">{firstName(names.g)}</span><span className="sm-only">{names.g.slice(0,1).toUpperCase()}</span></button>
                      <button className={t.assigned_to==='s'?'on-s':''} onClick={()=>assignTask(t.id,'s')} title={firstName(names.s)}><span className="lg-only">{firstName(names.s)}</span><span className="sm-only">{names.s.slice(0,1).toUpperCase()}</span></button>
                      <button className={!t.assigned_to?'on-r':''} onClick={()=>assignTask(t.id,null)} title="Rodízio">↻</button>
                    </div>
                    <button className="ib danger" onClick={()=>deleteTask(t.id)} title="Remover" aria-label="Remover">✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </>}
        </div>}


        {/* ── SEMANA ── */}
        {screen==='nos'&&<div className="scr">
          <div className="sh">
            <div><h2>Nós</h2><p>Semana de {fmtDate(weekStart)} · {en.l.toLowerCase()}</p></div>
            <div className="sh-a"><button className="btn btn-g" onClick={()=>openModal('meeting')}>📋 Reunião semanal</button><button className="btn btn-g" onClick={()=>go('ajustes')}>⚙️ Ajustes</button></div>
          </div>
          <div className="wgrid" style={{marginBottom:14}}>
            <div className="col">
              <Scoreboard scores={game.scores} lastWeek={game.lastWeek} lastWeekBet={game.lastWeekBet} bet={settings.bet} names={names} me={me} onEditBet={()=>openModal('bet')}/>
              <StreaksCard streaks={game.streaks} names={names} me={me}/>
            </div>
            <div className="col">
              <Achievements stats={game.stats} names={names} me={me}/>
            </div>
          </div>
          <div className="wgrid">
            <div className="col">
              <div className="card">
                <div className="slbl">Divisão da carga</div>
                <div className="opts c2" style={{marginBottom:14}}>
                  <button className={`opt ${casa.split==='smart'?'on':''}`} onClick={()=>saveSplit('smart')} disabled={isPending('split')}>
                    <div className="opt-t">✦ Inteligente</div><div className="opt-s">Quem fez por último passa a vez, equilibrando a semana</div>
                  </button>
                  <button className={`opt ${casa.split==='rotation'?'on':''}`} onClick={()=>saveSplit('rotation')} disabled={isPending('split')}>
                    <div className="opt-t">↻ Rodízio fixo</div><div className="opt-s">Alterna sempre na mesma ordem</div>
                  </button>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
                  <span style={{fontSize:14,fontWeight:500}}><span style={{color:'var(--green)'}}>●</span> {firstName(names.g)} <span style={{color:'var(--sub)',fontWeight:400}}>{gP}%</span></span>
                  <span style={{fontSize:12,color:balanced?'var(--green)':'var(--amb)'}}>{balanced?'✓ Equilibrado':`⚠ ${Math.round(Math.abs(gS-sS))} pts de diferença`}</span>
                  <span style={{fontSize:14,fontWeight:500}}><span style={{color:'var(--sub)',fontWeight:400}}>{100-gP}%</span> {firstName(names.s)} <span style={{color:'var(--pur)'}}>●</span></span>
                </div>
                <div className="balance"><div style={{width:gP+'%',background:'var(--gdk)',transition:'width .4s'}}/><div style={{flex:1,background:'var(--pur)'}}/></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--sub)',marginBottom:14}}>
                  <span><b style={{color:'var(--tx)',fontWeight:500}}>{Math.round(gS)}</b> pts · {act.filter(t=>t.assigned_to==='g').length} fixas</span>
                  <span><b style={{color:'var(--tx)',fontWeight:500}}>{Math.round(sS)}</b> pts · {act.filter(t=>t.assigned_to==='s').length} fixas</span>
                </div>
                {(rotCount>0||allRoutines.length>0)&&<div style={{fontSize:12,color:'var(--sub)',marginTop:-6,marginBottom:14}}><span className="tag-r">↻ {[rotCount>0&&`${rotCount} tarefa${rotCount!==1?'s':''}`,allRoutines.length>0&&`${allRoutines.length} rotina${allRoutines.length!==1?'s':''} dos cães`].filter(Boolean).join(' + ')} sem dona fixa</span> — {casa.split==='smart'?'divididas pela divisão inteligente':'alternam a cada dia, semana ou mês'}, metade da carga para cada</div>}
                <button className="btn btn-pur btn-w" onClick={autoDistribute}>✦ Distribuir automaticamente</button>
                <div style={{fontSize:12,color:'var(--sub)',marginTop:8,textAlign:'center'}}>Ou ajuste uma a uma em <button onClick={()=>goCasa('tarefas')} style={{background:'none',border:'none',color:'var(--pri)',fontSize:12}}>Casa › Tarefas →</button></div>
              </div>
              <div className="card">
                <div className="slbl">Energia da semana</div>
                <div className="opts">
                  {(['high','medium','low'] as const).map(v=>(
                    <button key={v} className={`opt ${settings.energy===v?'on':''}`} onClick={()=>setEnergy(v)}>
                      <div className="opt-t">{ENERGY[v].ic} {ENERGY[v].short}</div><div className="opt-s">{ENERGY[v].s}</div>
                    </button>
                  ))}
                </div>
                <div className="row" style={{marginTop:14,borderTop:'1px solid var(--bd)'}}>
                  <div><div className="row-t">🛡 Modo sobrevivência</div><div className="row-s">Mostra só as tarefas essenciais em Hoje</div></div>
                  <button className={`switch ${settings.survival?'on':''}`} onClick={toggleSurvival} role="switch" aria-checked={settings.survival} aria-label="Modo sobrevivência"/>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="card">
                <div className="slbl">Nível do casal</div>
                <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                  <span style={{fontSize:32,fontWeight:300,letterSpacing:'-.03em'}}>{xp}</span><span style={{color:'var(--sub)',fontSize:13}}>XP · Nv{lv.l} {lv.n}</span>
                </div>
                <div className="bar"><div className="barf" style={{width:xpPct+'%',background:'var(--pur)'}}/></div>
                <div style={{fontSize:12,color:'var(--sub)',marginTop:8}}>{lv.l<LEVELS.length?`Faltam ${lv.max-xp} XP para ${LEVELS[lv.l].n}`:'Nível máximo 🏆'}</div>
              </div>
              <div className="card">
                <div className="slbl">Últimas 4 semanas</div>
                {historyError?<div className="inline-err">Não foi possível carregar o histórico. <button className="lnk" onClick={loadHistory}>Tentar novamente</button></div>
                :!historyData?<div style={{fontSize:13,color:'var(--sub)',padding:'8px 0'}}>Carregando...</div>:
                  historyData.map((w,i)=>(
                    <div key={w.week} className="hist">
                      <div className="hist-h">
                        <span style={{fontSize:14,fontWeight:500}}>{i===0?'Esta semana':'Semana de '+fmtDate(w.week)}</span>
                        <span style={{fontSize:12,color:'var(--sub)'}}>{w.meeting&&<span className="bdg bdg-l" style={{marginRight:6}}>reunião ✓</span>}<span className="mono">{w.completions}</span> feitas</span>
                      </div>
                      <div className="bar" style={{marginTop:8}}><div className="barf" style={{width:(w.completions/maxHist*100)+'%',background:i===0?'var(--gdk)':'var(--faint)'}}/></div>
                      {w.meeting&&(w.meeting.wins||w.meeting.what_worked)&&(
                        <div className="hist-note">
                          {w.meeting.wins&&<div>🎉 {w.meeting.wins}</div>}
                          {w.meeting.what_worked&&<div>✓ {w.meeting.what_worked}</div>}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>}

        {/* ── CÃES ── */}
        {screen==='caes'&&<div className="scr">
          <div className="sh">
            <div><h2>Cães</h2><p>{dogs.length} pet{dogs.length!==1?'s':''}{dogDaily.length>0&&` · ${dogDone}/${dogDaily.length} rotinas hoje`}</p></div>
            <div className="sh-a"><button className="btn btn-s" onClick={()=>openModal('pet')}>+ Adicionar pet</button></div>
          </div>
          {puppies.map(pup=><PuppyPanel key={pup.id} dog={pup} accidents={cz.accidents} today={today} busy={isPending('acc:'+pup.id)} onAdd={loc=>addAccident(pup.id,loc)} onSave={fixAccident} onDelete={removeAccident}/>)}
          {dogs.length===0?(
            <div className="card empty"><span className="empty-icon">🐾</span>Nenhum pet cadastrado<div><button className="btn btn-p" onClick={()=>openModal('pet')}>Cadastrar pet</button></div></div>
          ):(
            <div className="dgrid">
              {dogs.map(dog=>{
                const daily=dog.routines.filter(r=>r.frequency==='daily')
                const periodic=dog.routines.filter(r=>r.frequency!=='daily')
                const dDone=daily.filter(r=>r.completed_today).length
                return(
                  <div key={dog.id} className="card">
                    <div className="dh">
                      <DogAvatar dog={dog}/>
                      <div style={{minWidth:0,flex:1}}><div className="pname">{dog.name}</div><div className="prole">{dog.breed||'Raça não informada'} · {dog.is_puppy?'Filhote':'Adulto'}</div></div>
                      {daily.length>0&&<Ring pct={Math.round(dDone/daily.length*100)} color="var(--green)" label={`${dDone}/${daily.length}`}/>}
                      <button className="ib" onClick={()=>openModal(cz.available?'dogprofile':'dog',dog)} title={`Editar ${dog.name}`} aria-label={`Editar ${dog.name}`}>✎</button>
                    </div>
                    {cz.available&&<DogHealthBlock dog={dog} records={cz.records} today={today} names={names}
                      onRecord={(k:HealthKind)=>openModal('health',{dog,record:null,kind:k})} onEdit={r=>openModal('health',{dog,record:r,kind:r.kind})} onBuyFood={buyFood}/>}
                    {dog.routines.length===0&&<div style={{fontSize:13,color:'var(--sub)',padding:'4px 0'}}>Nenhuma rotina ainda</div>}
                    {daily.length>0&&<><div className="slbl">Rotina diária</div>{daily.map(r=>dogRow(r,{dog}))}</>}
                    {periodic.length>0&&<>
                      <div className="slbl" style={{marginTop:14}}>Periódicas</div>
                      {periodic.map(r=>dogRow(r,{dog}))}
                    </>}
                    <button className="addr" onClick={()=>openModal('routine',{dog,routine:null})}>+ Nova rotina</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>}

        {/* ── AJUSTES ── */}
        {screen==='ajustes'&&<div className="scr narrow">
          <button className="back" onClick={()=>go('nos')}>← Nós</button>
          <div className="sh"><div><h2>Ajustes</h2><p>Aparência, conta, integrantes e guia de uso</p></div></div>
          <div className="card" style={{marginBottom:14}}>
            <div className="slbl">Aparência</div>
            <div className="themes" role="radiogroup" aria-label="Tema">
              {THEMES.map(t=>(
                <button key={t.id} role="radio" aria-checked={theme===t.id} className={`theme-opt ${theme===t.id?'on':''}`} onClick={()=>pickTheme(t.id)}>
                  <span className="theme-sw" aria-hidden="true">{t.swatch.map((c,i)=><i key={i} style={{background:c}}/>)}</span>
                  <span><b>{t.name}</b><small>{t.desc}</small></span>
                </button>
              ))}
            </div>
            <div className="row-s" style={{marginTop:8}}>Vale só para este aparelho: cada uma escolhe o que é mais confortável.</div>
          </div>
          {setup?.available&&<div className="card" style={{marginBottom:14}}>
            <div className="slbl">Configuração do Ninho</div>
            <div className="row-s" style={{marginBottom:10}}>{setup.completed?'Feita. Dá para refazer: rotinas que já existem não são duplicadas e nada é apagado.':'Ainda não feita: rotinas, essenciais, semana e aparência em 9 etapas.'}</div>
            <button className="btn btn-g" onClick={()=>setOnb(setup.completed?'redo':'open')}>{setup.completed?'Refazer configuração':'Configurar agora'}</button>
          </div>}
          <div className="card" style={{marginBottom:14}}>
            <div className="slbl">{account?'Sua conta':'Este aparelho'}</div>
            {account?<div className="field-row">
              <div className={`av av-${account.who}`}>{initials(names[account.who])}</div>
              <div style={{minWidth:0}}>
                <div className="row-t">{firstName(names[account.who])}</div>
                <div className="row-s" style={{overflow:'hidden',textOverflow:'ellipsis'}}>{account.email} · registra quem concluiu cada tarefa</div>
              </div>
              <button className="btn btn-g" style={{marginLeft:'auto'}} onClick={()=>{if(confirm('Sair da conta neste aparelho?'))account.onSignOut()}}>Sair</button>
            </div>:<div className="field-row">
              {me&&<div className={`av av-${me}`}>{initials(names[me])}</div>}
              <div style={{minWidth:0}}>
                <div className="row-t">{me?`Usado por ${firstName(names[me])}`:'Ninguém escolhido ainda'}</div>
                <div className="row-s">Registra quem concluiu cada tarefa. Fica salvo só neste aparelho; não é login.</div>
                {!device.persisted&&<div className="row-s" style={{color:'var(--amb)'}}>Este navegador não deixou salvar a escolha; ela vale até fechar o app.</div>}
              </div>
              <button className="btn btn-g" style={{marginLeft:'auto'}} onClick={()=>openModal('device')}>Trocar</button>
            </div>}
          </div>
          <NotificationsCard householdId={householdId} me={me} names={names} onToast={m=>showToast(m)}
            onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}
            onNeedIdentity={()=>openModal('device')}/>
          <TelegramCard householdId={householdId} me={me} names={names} onToast={m=>showToast(m)}
            onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}
            onNeedIdentity={()=>openModal('device')}/>
          <div className="card" style={{marginBottom:14}}>
            <div className="slbl">Integrantes</div>
            {(['g','s'] as Who[]).map(w=>(
              <div key={w} className="field-row">
                <div className={`av av-${w}`}>{initials(names[w])}</div>
                <div><div className="row-t">{firstName(names[w])}</div><div className="row-s">{ROLE[w]}</div></div>
                <input className="fi" key={names[w]} defaultValue={names[w]} onBlur={e=>updateName(w,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}} aria-label={`Nome de ${ROLE[w]}`}/>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:14}}>
            <div className="slbl">Resumo</div>
            <div className="row"><span className="row-t">Tarefas ativas</span><span className="mono" style={{marginLeft:'auto',color:'var(--sub)'}}>{tasks.length}</span></div>
            <div className="row"><span className="row-t">Pets</span><span className="mono" style={{marginLeft:'auto',color:'var(--sub)'}}>{dogs.length}</span></div>
            <div className="row"><span className="row-t">XP total</span><span className="mono" style={{marginLeft:'auto',color:'var(--sub)'}}>{xp} · Nv{lv.l}</span></div>
            <div className="row"><span className="row-t">Sequência</span><span className="mono" style={{marginLeft:'auto',color:'var(--sub)'}}>🔥 {streak} dias</span></div>
          </div>
          <div className="card guide">
            <div className="slbl">Guia do Ninho</div>
            <details open><summary>☀️ Hoje</summary><div className="gb">
              <p>A tela do dia. Cada uma tem sua coluna (no celular, troque pelo seletor no topo) com o anel de progresso e só o que está pendente <b>hoje</b>.</p>
              <ul>
                <li><b>Grupos por horário:</b> ⚠ Atrasadas (diárias com horário que já passou), 🌅 Manhã, ☀️ Tarde, 🌙 Noite, a qualquer hora e, por fim, as do período (até o fim da semana, quinzena ou mês) e as pontuais.</li>
                <li><b>▸ próxima</b> destaca a próxima tarefa com horário.</li>
                <li>Toque na tarefa para concluir. Aparece <b>+XP · Desfazer</b> por alguns segundos. As concluídas ficam recolhidas no fim da coluna, com <b>quem concluiu</b> (conclusões anteriores a esta versão aparecem como “não identificado”).</li>
                <li><b>Sua conta</b> (e-mail e senha) diz quem está usando o celular; é isso que fica registrado ao concluir. Ver a coluna da outra pessoa não muda isso. Se o banco recusar uma alteração, o app desfaz na tela e mostra o aviso com “Tentar novamente”.</li>
                <li>No computador, <b>⇄</b> passa para a outra e <b>✎</b> edita. No celular, tudo isso fica no <b>⋯</b>.</li>
                <li>Indicadores do topo: % do dia, estado da <b>Casa</b> (quanto das diárias ainda falta: organizada, atenção ou alerta), nível/XP e sequência.</li>
              </ul>
            </div></details>
            <details><summary>📋 Tarefas</summary><div className="gb">
              <p>A lista completa, agrupada por cômodo, com busca e filtros (essenciais, por pessoa, rodízio, sem horário e por cômodo).</p>
              <ul>
                <li><b>Ajuste rápido:</b> toque em “○ essencial” para ligar/desligar e em “+ horário” para definir a hora — sem abrir o formulário.</li>
                <li><b>Responsável:</b> escolha {firstName(names.g)}, {firstName(names.s)} ou ↻ rodízio direto no card.</li>
                <li>Toque no nome para editar tudo (cômodo, esforço, frequência, horário) ou remover.</li>
                <li><b>✦ Sugestões:</b> listas prontas por cômodo; selecione várias ou toque em ✎ para ajustar antes de criar.</li>
              </ul>
            </div></details>
            <details><summary>📅 Frequência</summary><div className="gb">
              <ul>
                <li><b>Diária:</b> volta todo dia.</li>
                <li><b>Semanal:</b> aparece até ser feita; depois some até a próxima segunda.</li>
                <li><b>Quinzenal:</b> uma vez a cada duas semanas (blocos fixos de 2 semanas).</li>
                <li><b>Mensal:</b> uma vez por mês do calendário.</li>
                <li><b>Pontual:</b> feita uma vez, some de vez.</li>
              </ul>
              <p>Cada tarefa mostra quando foi feita pela última vez (“há 9 dias”, “nunca feita”). Só dá para desmarcar o que foi feito hoje.</p>
              <ul>
                <li><b>📆 Dias da semana</b> (no formulário da tarefa): a diária aparece só nesses dias (ex.: lixo seg, qua e sex). A semanal ou quinzenal aparece a partir do primeiro dia escolhido (ex.: faxina a partir de sábado).</li>
                <li><b>Pontual com data:</b> aparece em Hoje a partir da data e fica em ⚠ Atrasadas se passar.</li>
                <li><b>⤼ Pular</b> (no ⋯ da tarefa, ou ⏭ no computador): resolve o dia, a semana ou o mês sem XP e <b>sem quebrar a sequência</b>. <b>⏭ Deixar para amanhã:</b> some só hoje. As puladas ficam no fim da coluna com “↺ Voltar”.</li>
              </ul>
            </div></details>
            <details><summary>↻ Divisão das tarefas</summary><div className="gb">
              <p>Tarefas sem responsável fixa (↻) são divididas entre vocês. Escolha o jeito em <b>Semana › Divisão da carga</b>:</p>
              <ul>
                <li><b>✦ Inteligente</b> (padrão): <b>quem fez por último passa a vez</b>. Se uma cobriu a outra, a vez se ajusta sozinha. Se uma já está com bem mais carga (o que é fixo dela + o que fez na semana), a próxima vai para a outra. Diárias são decididas a cada dia; semanais, quinzenais e mensais uma vez por período, para não trocarem de dona no meio da semana.</li>
                <li><b>↻ Rodízio fixo:</b> alterna sempre na mesma ordem (a cada dia, semana ou mês).</li>
              </ul>
              <p>No celular, toque em <b>⋯</b> numa tarefa para ver <b>por que é a vez de quem</b>. A conta é a mesma nos dois celulares e no bom dia.</p>
              <p>Usar ⇄ numa tarefa de rodízio fixa ela com a outra pessoa (dá para desfazer).</p>
              <p>Em <b>Semana › Divisão da carga</b> vocês veem os pontos de cada uma (esforço × frequência; rodízio conta metade para cada). <b>✦ Distribuir automaticamente</b> reparte tudo de forma equilibrada — atenção: ele define responsável fixo para todas e tira do rodízio.</p>
            </div></details>
            <details><summary>🛒 Compras</summary><div className="gb">
              <ul>
                <li>Lista compartilhada <b>ao vivo</b>: o que uma adiciona ou risca aparece na hora no celular da outra.</li>
                <li>Digite com a quantidade (“2 kg arroz”, “leite 3”) e a categoria é escolhida sozinha (dá para trocar). A lista fica na ordem dos corredores do mercado.</li>
                <li>Item repetido não duplica; se estava riscado, volta para a lista.</li>
                <li>No mercado, toque para riscar. <b>Finalizar compra</b> tira os riscados (com Desfazer) e oferece marcar a tarefa “Mercado semanal”.</li>
                <li><b>Comprar de novo:</b> os itens mais comprados nos últimos meses, a um toque.</li>
              </ul>
            </div></details>
            <details><summary>🔧 Manutenção</summary><div className="gb">
              <ul>
                <li>Em <b>Tarefas › Manutenção</b>: coisas de tempos em tempos (filtro do ar, vermífugo, vacina, revisão do carro). Use <b>✦ Modelos prontos</b> para começar.</li>
                <li>Ao marcar <b>✓ Feita</b> (+3 XP), a próxima data é calculada sozinha. Dá para desfazer.</li>
                <li>Aparece em <b>Hoje</b> quando falta pouco (3 dias) ou está atrasada, e no <b>bom dia</b> no dia em que vence.</li>
              </ul>
            </div></details>
            <details><summary>🐾 Cães</summary><div className="gb">
              <ul>
                <li>Cada cão tem suas <b>rotinas</b> (diárias, semanais, quinzenais ou mensais, com horário opcional). Use ✎ no cão para editar nome, raça e fase, e ✎ na rotina para mudar ou remover. “+ Nova rotina” adiciona.</li>
                <li>Em Hoje, a mesma rotina de cães diferentes (ex.: Ração manhã) vira <b>um item só</b>: um toque marca para todos. Elas entram no rodízio e aparecem na lista de quem é a vez; a bolinha com a inicial na aba Cães mostra de quem é.</li>
                <li><b>Modo filhote:</b> registre acidentes por cômodo e acompanhe o dia.</li>
                <li>Tarefas da categoria Cães repetem as rotinas e por isso não aparecem em Hoje; dá para arquivá-las pelo aviso em Tarefas.</li>
              </ul>
            </div></details>
            <details><summary>📲 App e notificações</summary><div className="gb">
              <ul>
                <li><b>Instalar:</b> no Android, “Instalar” em Ajustes (ou menu ⋮ → Instalar app). No iPhone, Safari → Compartilhar → Adicionar à Tela de Início. O Ninho vira um ícone e abre como app.</li>
                <li><b>Sem internet:</b> o app abre com os últimos dados que carregou neste aparelho. Marcar e editar voltam quando a conexão voltar.</li>
                <li><b>☀️ Bom dia</b> (por volta das 7h): o que é seu hoje — fixo ou pela vez do rodízio — e o que vale ⚡ no horário.</li>
                <li><b>🏆 Resumo de domingo</b> (por volta das 19h): placar, quem paga a aposta, sequência e o que ficou para trás.</li>
                <li>Cada aparelho ativa as próprias notificações em Ajustes, e elas seguem “Este aparelho”. No iPhone, só com o app instalado (iOS 16.4+).</li>
              </ul>
            </div></details>
            <details><summary>💬 Telegram e ✦ IA</summary><div className="gb">
              <ul>
                <li><b>Telegram:</b> em Ajustes › Telegram: <b>Conectar</b> liga o seu; <b>Gerar convite</b> cria um link para mandar à outra pelo WhatsApp. O bom dia e o resumo de domingo chegam lá também.</li>
                <li><b>Menu fixo</b> no Telegram: 📋 Hoje, 🛒 Compras, ➕ Adicionar à lista, ✦ Dicas e ❓ Ajuda. Ao tocar no ✓ de uma tarefa, o botão some na hora e o resultado aparece no topo da lista.</li>
                <li>Comandos: <b>/hoje</b> (o que é seu, com botões ✓ para concluir), <b>/feito louça</b>, <b>/compras</b> (ver a lista), <b>/compras leite, 2 kg arroz</b> ou <b>+leite</b> (adicionar), <b>/dicas</b> e <b>/sair</b>.</li>
                <li><b>✦ IA:</b> na Reunião semanal (e no /dicas), a IA lê a semana (placar, quem fez o quê, puladas, o que pesou na reunião passada) e sugere de 3 a 5 ajustes. São sugestões, não regras. Limite de 6 pedidos por dia. O resumo da semana é enviado à Anthropic para gerar as sugestões.</li>
              </ul>
            </div></details>
            <details><summary>🌤 Energia e modo sobrevivência</summary><div className="gb">
              <p>Escolham a <b>energia da semana</b> (alta, média ou baixa). Em energia baixa ou no <b>🛡 modo sobrevivência</b>, Hoje mostra só as essenciais e as rotinas dos cães, com o botão “Mostrar todas”. Vale para a semana atual.</p>
            </div></details>
            <details><summary>📋 Reunião semanal</summary><div className="gb">
              <p>15 minutos, sem cobranças: o que funcionou, o que pesou, ajuste, prioridades, como cada uma chega, vitórias, modo da próxima semana e recompensa. Fica no histórico em Semana.</p>
            </div></details>
            <details><summary>🏆 XP, níveis e sequência</summary><div className="gb">
              <ul>
                <li>Cada tarefa vale pelo esforço: <span className="xp xp-l">+1</span> leve, <span className="xp xp-m">+2</span> médio, <span className="xp xp-h">+3</span> pesado. Rotina de cão vale +1 por cão. O nível é do casal.</li>
                <li><b>⚡ Bônus no horário:</b> diária com horário feita até o horário vale ×1,5 (leve 2, média 3, pesada 5). Feita atrasada no mesmo dia vale o normal: ninguém perde pontos. O ⚡ aparece no XP enquanto ainda dá tempo.</li>
                <li><b>🏆 Placar da semana:</b> o XP de cada uma de segunda a domingo, com a aposta simbólica (troque em Semana). Conta pelo aparelho identificado de quem concluiu.</li>
                <li><b>🔥 Sequências:</b> casa ativa (algo feito no dia), casa em dia (todas as essenciais diárias feitas) e a de cada uma, com recordes. A de hoje só entra depois do primeiro check; ninguém perde a sequência no meio do dia.</li>
                <li><b>🏅 Conquistas:</b> bronze, prata e ouro por cômodo, cães, pontualidade, madrugada, tarefas pesadas, faxina relâmpago (várias tarefas em 1 hora) e recorde de sequência.</li>
                <li>Níveis: {LEVELS.map(l=>`${l.n} (${l.min})`).join(' · ')}.</li>
              </ul>
            </div></details>
            <details><summary>🔣 Símbolos</summary><div className="gb">
              <ul>
                <li><span className="tag-e">● essencial</span> — não pode falhar; caixinha laranja; aparece mesmo no modo sobrevivência.</li>
                <li><span className="tag-t">⏰ 08:00</span> horário · <span className="tag-t late">⏰ 07:00</span> atrasada.</li>
                <li><span className="tag-r">↻</span> rodízio · <span className="tag-next">▸ próxima</span> próxima com horário.</li>
                <li>Bolinha <span style={{color:'var(--green)'}}>●</span> leve, <span style={{color:'var(--amb)'}}>●</span> média, <span style={{color:'var(--cor)'}}>●</span> pesada (na lista de Tarefas).</li>
              </ul>
              <p>Tudo sincroniza na hora entre os celulares de vocês.</p>
            </div></details>
          </div>
        </div>}
        </>}
      </main>

      {/* NAV MOBILE */}
      </div>
      <BottomNav current={screen} onGo={go}/>

      {data.status==='ready'&&screen!=='ajustes'&&<button className="fab mob-fab" onClick={()=>openModal('quick')} aria-label="Ação rápida"><Icon name="plus" size={24}/></button>}
      {modal==='quick'&&<QuickActionsSheet onClose={closeModal} actions={quickActions}/>}

      {toast&&<div className={`toast ${toast.kind==='err'?'err':''}`} role={toast.kind==='err'?'alert':'status'}>
        <span className="toast-m">{toast.msg}</span>
        {toast.undo&&<button onClick={toast.undo}>Desfazer</button>}
        {toast.retry&&<button onClick={()=>{const r=toast.retry!;setToast(null);r()}}>Tentar novamente</button>}
        {toast.kind==='err'&&<button className="tx" onClick={()=>setToast(null)} aria-label="Fechar aviso">✕</button>}
      </div>}
      {modal==='task'&&<TaskFormModal task={modalData} names={names} saving={saving} casaOk={casaOk} onClose={closeModal} onSave={saveTask} onDelete={deleteTask}/>}
      {modal==='sugg'&&<SuggModal tasks={tasks} onClose={closeModal} onAdd={addSuggestions} onCustomize={s=>openModal('task',{title:s.t,category:s.cat,weight:s.w,frequency:s.f,essential:s.ess,assigned_to:null,scheduled_time:null,active:true,id:null})}/>}
      {modal==='pet'&&<PetModal saving={saving} onClose={closeModal} onSave={savePet}/>}
      {modal==='taskmenu'&&(()=>{const t:Task=modalData;const other:Who=ownerOfTask(t)==='g'?'s':'g';const why=whyLabel(plan.whyOf(t.id),names,today);return(
        <Sheet size="sm" title={t.title} onClose={closeModal}>
          {why&&<div className="why">↻ {why}</div>}
          <div className="menu">
            <button className="btn btn-s" onClick={()=>{closeModal();toggleTask(t)}}>{t.completed_today?'↺ Desmarcar':'✓ Concluir'}</button>
            {!t.completed_today&&t.frequency!=='daily'&&<button className="btn btn-g" onClick={()=>{closeModal();pauseTask(t,'snooze')}}>⏭ Deixar para amanhã</button>}
            {!t.completed_today&&SKIP_LABEL[t.frequency]&&<button className="btn btn-g" onClick={()=>{closeModal();pauseTask(t,'skip')}}>⤼ {SKIP_LABEL[t.frequency]}<small className="menu-s">sem XP · não quebra a sequência</small></button>}
            <button className="btn btn-g" onClick={()=>{closeModal();swapTask(t)}}>⇄ Passar para {firstName(names[other])}</button>
            {casaOk&&!t.completed_today&&(t.help_by
              ?<button className="btn btn-g" onClick={()=>{closeModal();askHelp(t,false)}}>🙋 Cancelar pedido de ajuda</button>
              :<button className="btn btn-g" onClick={()=>{closeModal();askHelp(t,true)}}>🙋 Pedir ajuda a {firstName(names[other])}<small className="menu-s">ela vê o pedido na hora</small></button>)}
            <button className="btn btn-g" onClick={()=>openModal('task',t)}>✎ Editar tarefa</button>
          </div>
        </Sheet>
      )})()}
      {modal==='dog'&&<DogModal dog={modalData} saving={saving} onClose={closeModal} onSave={updateDog} onDelete={removeDog}/>}
      {modal==='routine'&&<RoutineModal routine={modalData.routine} dogName={modalData.dog.name} saving={saving} onClose={closeModal} onSave={(d,id)=>saveRoutine(modalData.dog.id,d,id)} onDelete={removeRoutine}/>}
      {modal==='energy'&&<EnergyModal energy={settings.energy} onClose={closeModal} onPick={setEnergy}/>}
      {onb&&me&&setup&&<Onboarding householdId={householdId} me={me} names={names} dogs={dogs.map(d=>({id:d.id,name:d.name}))}
        dogRoutineTitles={dogs.flatMap(d=>d.routines.map(r=>r.title))} tasks={tasks} existingKeys={routines.map(r=>r.template_key).filter((k):k is string=>!!k)}
        setup={setup} redo={onb==='redo'} theme={theme} onTheme={pickTheme}
        onClose={()=>{setOnb(null);loadSetup(false)}}
        onDone={(_,to)=>{setOnb(null);loadSetup(false);rot.reload();data.reloadNames();data.reloadDogs();data.reloadTasks();go(to)}}/>}
      {device.ready&&!account&&(!me||modal==='device')&&<DeviceIdentityModal names={names} current={me} required={!me}
        onPick={w=>{device.setWho(w);if(modal==='device')closeModal();showToast(`Este aparelho agora é da ${firstName(names[w])}`)}}
        onClose={closeModal}/>}
      {modal==='bet'&&<BetModal current={settings.bet} saving={saving} onClose={closeModal} onSave={saveBet}/>}
      {modal==='maint'&&<MaintenanceForm extras={casa.maintExtras} item={modalData} today={today} names={names} saving={saving} onClose={closeModal} onSave={saveMaint} onDelete={removeMaint}/>}
      {sprintOpen&&sp.available&&<SprintPanel active={sp.active} recent={sp.recent} now={sp.now} tasks={tasks} today={today} me={me} names={names} busy={spBusy}
        onStart={startSprint} onPause={pauseSprint} onFinish={finishSprint} onToggleTask={toggleTask} onSetTasks={setSprintTasks} onClose={()=>setSprintOpen(false)}/>}
      {modal==='dogprofile'&&<DogProfileSheet dog={modalData} today={today} saving={saving} onSave={updateDog} onDelete={removeDog} onClose={closeModal}/>}
      {modal==='health'&&<HealthSheet dog={modalData.dog} record={modalData.record} kind={modalData.kind} today={today} saving={saving} onSave={saveHealth} onDelete={deleteHealth} onClose={closeModal}/>}
      {modal==='event'&&<EventSheet event={modalData?.event??null} kind={modalData?.kind??'compromisso'} today={today} names={names} saving={saving}
        onSave={saveEvent} onDelete={deleteEvent} onReopen={e=>eventDone(e,false)} onClose={closeModal}/>}
      {modal==='rtedit'&&<RoutineEditor routine={modalData} names={names} saving={saving} onSave={saveRoutineDraft} onArchive={archiveRoutine} onClose={closeModal} onSaveTemplate={rot.templates?saveRoutineTemplate:undefined}/>}
      {modal==='rttpl'&&<TemplatesSheet existingKeys={routines.map(r=>r.template_key).filter((k):k is string=>!!k)} existingTitles={routines.map(r=>r.title)} house={rot.templates} busy={tplBusy} onAdd={addRoutineTemplate} onAddHouse={addHouseTemplate} onDeleteHouse={deleteHouseTemplate} onClose={closeModal}/>}
      {modal==='hbedit'&&<HabitEditor habit={modalData?.habit??null} preset={modalData?.preset} names={names} saving={saving} onSave={saveHabitDraft} onArchive={archiveHabit} onClose={closeModal}/>}
      {modal==='mainttpl'&&<MaintTemplatesSheet existing={casa.maint} today={today} saving={saving} onClose={closeModal} onAdd={addMaintTemplates}/>}
      {modal==='meeting'&&<MeetingModal householdId={householdId} names={names} weekStart={weekStart} saving={saving} onClose={closeModal} onSave={saveMeeting}/>}
    </>
  )
}
