'use client'
// Peças de UI e janelas do app (separadas do NinhoApp: ficam fora do componente principal para não remontar a cada render).
import { useEffect, useState } from 'react'
import type { Dog, DogRoutine, Meeting, Names, Task, Who } from '@/lib/types'
import { CAT, DR_DEF, DR_PUP, ENERGY, FPT, RFREQ, WPT } from '@/lib/constants'
import { fmtDate, hhmm } from '@/lib/dates'
import { WEEKDAY_SHORT } from '@/lib/frequency'
import { XPW } from '@/lib/xp'
import * as api from '@/lib/services/ninho'
import { Sheet } from '@/components/ui/Sheet'
import { fetchAiTips, fetchMeetDraft } from '@/components/TelegramCard'
import { applyDraft } from '@/lib/reuniao'
import { type Agreement, type AgendaSection } from '@/lib/nos'

export function firstName(n:string){return (n||'').split(' ')[0]}
export function initials(n:string){return (n||'??').slice(0,2).toUpperCase()}
export function wCls(w:string){return w==='light'?'l':w==='medium'?'m':'h'}
export function byCat(list:Task[]){const g:Record<string,Task[]>={};list.forEach(t=>{(g[t.category]=g[t.category]||[]).push(t)});return Object.entries(g)}
export function catIc(c:string){return (CAT[c]||'').split(' ')[0]}


// ── PEÇAS DE UI (fora do componente principal para não remontar a cada render) ──
// Horário editável direto na lista de Tarefas
export function QuickTime({value,onSave}:{value:string,onSave:(v:string)=>void}){
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

export function TaskFormModal({task,names,saving,casaOk,periodOk,onClose,onSave,onDelete}:{task:Task|null,names:Names,saving:boolean,casaOk?:boolean,periodOk?:boolean,onClose:()=>void,onSave:(d:any,id?:string)=>void,onDelete:(id:string)=>void}){
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
  const[from,setFrom]=useState(t?.starts_on||'')
  const[until,setUntil]=useState(t?.ends_on||'')
  const[prio,setPrio]=useState<'alta'|'normal'|'baixa'>(t?.priority||'normal')
  const[notes,setNotes]=useState(t?.notes||'')
  const[check,setCheck]=useState<Array<{t:string,d:boolean}>>(t?.checklist||[])
  const[newItem,setNewItem]=useState('')
  const[hist,setHist]=useState<Awaited<ReturnType<typeof api.taskHistory>>|null>(null)
  useEffect(()=>{if(editing&&t?.id)api.taskHistory(t.id).then(setHist).catch(()=>setHist([]))},[editing,t?.id])
  const addItem=()=>{const v=newItem.trim();if(!v||check.length>=30)return;setCheck(c=>[...c,{t:v.slice(0,80),d:false}]);setNewItem('')}
  const usesDays=['daily','weekly','biweekly'].includes(freq)
  const toggleDay=(d:number)=>setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d])
  const usesPeriod=freq!=='once'
  const badPeriod=usesPeriod&&!!from&&!!until&&until<from
  const handle=()=>{if(!title.trim()||saving||badPeriod)return
    const wd=usesDays&&days.length&&days.length<7?[...days].sort():null
    const extra:any={}
    // Só envia as colunas novas quando usadas (o app funciona mesmo antes da migration 008)
    if(wd||t?.weekdays)extra.weekdays=wd
    if((freq==='once'&&due)||t?.due_date)extra.due_date=freq==='once'&&due?due:null
    // Migration 039: período só quando o banco já tem as colunas (pontual usa a data)
    if(periodOk){extra.starts_on=usesPeriod&&from?from:null;extra.ends_on=usesPeriod&&until?until:null}
    // Migration 019: só envia quando o banco já tem as colunas
    if(casaOk){extra.priority=prio;extra.notes=notes.trim()||null;extra.checklist=check.filter(c=>c.t.trim())}
    onSave({title:title.trim(),category:cat,weight,frequency:freq,assigned_to:assign||null,scheduled_time:time||null,essential:ess,...extra},editing?t!.id:undefined)}
  return(
    <Sheet title={editing?'Editar tarefa':'Nova tarefa'} onClose={onClose} footer={<>
      {editing&&<button className="btn btn-danger" disabled={saving} onClick={()=>onDelete(t!.id)}>Remover</button>}
      <button className="btn btn-p" disabled={!title.trim()||saving||badPeriod} onClick={handle}>{saving?'Salvando…':editing?'Salvar alterações':'Criar tarefa'}</button>
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
      {periodOk&&usesPeriod&&<>
        <label className="fl" id="tk-per">Período <span className="hint">(opcional · só aparece nesses dias; vazio = sempre)</span></label>
        <div className="tk-per" role="group" aria-labelledby="tk-per">
          <label className="onb-f"><span>De</span><input type="date" className="fi" value={from} max={until||undefined} onChange={e=>setFrom(e.target.value)}/></label>
          <label className="onb-f"><span>Até</span><input type="date" className="fi" value={until} min={from||undefined} onChange={e=>setUntil(e.target.value)}/></label>
          {(from||until)&&<button type="button" className="btn btn-g" onClick={()=>{setFrom('');setUntil('')}}>Sem período</button>}
        </div>
        {badPeriod&&<div className="hint" role="alert" style={{color:'var(--cor-tx)'}}>O "até" precisa ser depois do "de".</div>}
      </>}
      <label className="fl">Horário <span className="hint">(opcional)</span></label>
      <input type="time" className="fi" aria-label="Horário" value={time} onChange={e=>setTime(e.target.value)} style={{maxWidth:180}}/>
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

export function PetModal({saving,onClose,onSave}:{saving:boolean,onClose:()=>void,onSave:(d:any,r:any[])=>void}){
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

export function DogModal({dog,saving,onClose,onSave,onDelete}:{dog:Dog,saving:boolean,onClose:()=>void,onSave:(id:string,d:any)=>void,onDelete:(d:Dog)=>void}){
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

export function RoutineModal({routine,dogName,saving,onClose,onSave,onDelete}:{routine:DogRoutine|null,dogName:string,saving:boolean,onClose:()=>void,onSave:(d:any,id?:string)=>void,onDelete:(r:DogRoutine)=>void}){
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

export function EnergyModal({energy,onClose,onPick}:{energy:string,onClose:()=>void,onPick:(e:'high'|'medium'|'low')=>void}){
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

export function MeetingModal({householdId,names,weekStart,saving,initial,agenda,agreementsOk,onClose,onSave}:{householdId:string,names:Names,weekStart:string,saving:boolean,initial?:Partial<Meeting>&{agreements?:Agreement[]}|null,agenda?:AgendaSection[],agreementsOk?:boolean,onClose:()=>void,onSave:(m:Meeting,agreements:Array<Agreement&{makeTask?:boolean}>|null,sendTg:boolean)=>void}){
  const blank:Meeting={what_worked:'',what_overloaded:'',adjustments:'',priorities:'',mood_g:'ok',mood_s:'ok',wins:'',next_mode:'normal',reward:''}
  const[form,setForm]=useState<Meeting>(()=>{const i:any=initial||{};return Object.fromEntries(Object.entries(blank).map(([k,v])=>[k,i[k]??v])) as Meeting})
  const[agr,setAgr]=useState<Array<Agreement&{makeTask?:boolean}>>(initial?.agreements||[])
  const[newAgr,setNewAgr]=useState<{text:string,who:Who|'both',makeTask:boolean}>({text:'',who:'both',makeTask:false})
  const[showAgenda,setShowAgenda]=useState(true)
  const[ai,setAi]=useState<{state:'idle'|'busy'|'ok'|'err',tips?:string[],error?:string}>({state:'idle'})
  async function askAi(){setAi({state:'busy'});const r=await fetchAiTips(householdId);setAi(r.tips?{state:'ok',tips:r.tips}:{state:'err',error:r.error})}
  const[draft,setDraft]=useState<{state:'idle'|'busy'|'ok'|'err',summary?:string,filled?:number,error?:string,undo?:{form:Meeting,agr:Array<Agreement&{makeTask?:boolean}>}}>({state:'idle'})
  const[sendTg,setSendTg]=useState(false)
  async function askDraft(){
    setDraft({state:'busy'})
    const r=await fetchMeetDraft(householdId,(agenda||[]).flatMap(s=>s.lines.map(l=>`${s.title}: ${l}`)))
    if(!r.draft){setDraft({state:'err',error:r.error});return}
    const out=applyDraft(form,agr,r.draft)
    setDraft({state:'ok',summary:r.draft.summary,filled:out.filled,undo:{form,agr}})
    setForm(out.form);setAgr(out.agreements as any)
  }
  const useTip=(t:string)=>setForm(p=>({...p,adjustments:p.adjustments?`${p.adjustments}\n${t}`:t}))
  const set=(k:keyof Meeting,v:string)=>setForm(p=>({...p,[k]:v}))
  const addAgr=()=>{if(!newAgr.text.trim()||agr.length>=20)return;setAgr(l=>[...l,{text:newAgr.text.trim().slice(0,140),who:newAgr.who,task_id:null,done:false,makeTask:newAgr.makeTask}]);setNewAgr(x=>({...x,text:''}))}
  const moods=[['😌 Bem','ok'],['😐 Ok','mid'],['😔 Difícil','hard']]
  const modes=[['🌿 Normal','normal'],['⚡ Boss Mode','boss'],['🛡 Sobrevivência','survival']]
  const area=(n:string,k:keyof Meeting,label:string,ph:string)=>(
    <div className="meet"><label className="fl">{n} — {label}</label><textarea className="fita" value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={ph}/></div>
  )
  return(
    <Sheet size="lg" title="📋 Reunião semanal" onClose={onClose} footer={<div className="mt-foot">
      <label className="mt-mk"><input type="checkbox" checked={sendTg} onChange={e=>setSendTg(e.target.checked)}/> 📨 Mandar o resumo no Telegram das duas</label>
      <button className="btn btn-p" disabled={saving} onClick={()=>onSave(form,agreementsOk?agr:null,sendTg)}>{saving?'Salvando…':'Salvar reunião'}</button></div>}>
      <div style={{fontSize:13,color:'var(--sub)',marginBottom:14}}>Semana de {fmtDate(weekStart)} · 15 minutos · sem cobranças</div>
      {agenda&&agenda.length>0&&<section className="mt-agenda" aria-labelledby="mt-ag">
        <button className="mt-ag-h" id="mt-ag" aria-expanded={showAgenda} onClick={()=>setShowAgenda(v=>!v)}><span>📊 Pauta: o que aconteceu na semana</span><span aria-hidden="true">{showAgenda?'−':'+'}</span></button>
        {showAgenda&&agenda.map(sec=>(<div key={sec.title} className="mt-sec"><div className="mt-sec-t">{sec.icon} {sec.title}</div><ul>{sec.lines.map((l,i)=><li key={i}>{l}</li>)}</ul></div>))}
      </section>}
      <div className="aibox">
        {draft.state==='idle'&&<button className="btn btn-pur btn-w" onClick={askDraft}>✦ Rascunho da reunião com IA</button>}
        {draft.state==='busy'&&<div className="ai-wait" role="status"><span className="spin" aria-hidden="true"/>A IA está montando o rascunho da reunião…</div>}
        {draft.state==='err'&&<div className="inline-err" role="alert">{draft.error} <button className="lnk" onClick={askDraft}>Tentar de novo</button></div>}
        {draft.state==='ok'&&<div className="mt-draft" role="status">
          <div className="slbl">✦ Rascunho da IA</div>
          {draft.summary&&<p className="mt-draft-s">{draft.summary}</p>}
          <p className="row-s">{draft.filled?`Preenchi ${draft.filled} item(ns) que estavam vazios. O que vocês já tinham escrito não mudou. Confiram e editem à vontade.`:'Vocês já tinham preenchido tudo; nada foi trocado.'}</p>
          {!!draft.filled&&<button className="lnk-inline" onClick={()=>{setForm(draft.undo!.form);setAgr(draft.undo!.agr);setDraft({state:'idle'})}}>Desfazer rascunho</button>}
        </div>}
        {ai.state==='idle'&&<button className="btn btn-g btn-w" style={{marginTop:8}} onClick={askAi}>✦ Só sugestões de ajuste</button>}
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
      {agreementsOk&&<div className="meet mt-agr">
        <label className="fl">07 — Combinados da semana</label>
        {agr.length===0&&<div className="row-s" style={{marginBottom:8}}>Combinados curtos e concretos. Se quiser, cada um vira uma tarefa.</div>}
        <ul className="mt-agr-l">{agr.map((a,i)=>(
          <li key={i}>
            <button className={`mt-chk ${a.done?'on':''}`} role="checkbox" aria-checked={a.done} aria-label={`Cumprido: ${a.text}`} onClick={()=>setAgr(l=>l.map((x,j)=>j===i?{...x,done:!x.done}:x))}>{a.done?'✓':''}</button>
            <span className="mt-agr-t">{a.text}<small>{a.who==='both'?'as duas':firstName(names[a.who])}{a.task_id?' · virou tarefa':a.makeTask?' · vai virar tarefa':''}</small></span>
            <button className="ib" aria-label={`Remover ${a.text}`} onClick={()=>setAgr(l=>l.filter((_,j)=>j!==i))}>✕</button>
          </li>))}</ul>
        <div className="mt-agr-add">
          <input className="fi" value={newAgr.text} maxLength={140} placeholder="Ex.: ligar para o encanador" aria-label="Novo combinado" onChange={e=>setNewAgr(x=>({...x,text:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')addAgr()}}/>
          <div className="btng c3">{([['both','As duas'],['g',firstName(names.g)],['s',firstName(names.s)]] as Array<[Who|'both',string]>).map(([v,l])=><button key={v} className={`sbtn ${newAgr.who===v?'on':''}`} onClick={()=>setNewAgr(x=>({...x,who:v}))}>{l}</button>)}</div>
          <label className="mt-mk"><input type="checkbox" checked={newAgr.makeTask} onChange={e=>setNewAgr(x=>({...x,makeTask:e.target.checked}))}/> Virar tarefa em Casa</label>
          <button className="btn btn-g" disabled={!newAgr.text.trim()} onClick={addAgr}>+ Combinado</button>
        </div>
      </div>}
      <div className="meet">
        <label className="fl">{agreementsOk?'08':'07'} — Modo da próxima semana</label>
        <div className="btng c3">{modes.map(([l,v])=><button key={v} className={`sbtn ${form.next_mode===v?'on':''}`} onClick={()=>set('next_mode',v)}>{l}</button>)}</div>
      </div>
      <div className="meet">
        <label className="fl">{agreementsOk?'09':'08'} — Recompensa do casal <span className="hint">(se merecer)</span></label>
        <input className="fi" value={form.reward} onChange={e=>set('reward',e.target.value)} placeholder="Ex: jantar fora, noite de filme, delivery..."/>
      </div>
    </Sheet>
  )
}

// ── APP ─────────────────────────────────────────────────
