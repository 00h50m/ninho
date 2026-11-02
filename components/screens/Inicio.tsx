'use client'
// Início: saudação, o que fazer agora, cartões do dia e a semana.
// O estado e as ações vêm de useNinhoApp (components/app/useNinhoApp.tsx).
import type { Who } from '@/lib/types'
import { useState } from 'react'
import { focusList } from '@/lib/foco'
import { FocusSheet } from '@/components/inicio/Foco'
import { setupSnoozed } from '@/lib/a11y'
import { addDays, fmtDate, hhmm } from '@/lib/dates'
import { dueToday } from '@/lib/frequency'
import { MaintTodayCard } from '@/components/casa/Maintenance'
import { shoppingCounts } from '@/lib/shopping'
import { byTime, isLate } from '@/lib/today'
import { weekDots } from '@/lib/xp'
import { toNinhoError } from '@/lib/errors'
import { LAST_STEP } from '@/lib/onboarding'
import { turnBy } from '@/lib/rotation'
import { WeekStrip } from '@/components/inicio/WeekStrip'
import { CheckinCard } from '@/components/inicio/CheckinCard'
import { RoutineNowCard } from '@/components/inicio/RoutineNowCard'
import { type Routine } from '@/lib/rotinas'
import { useSoon, urgencyLabel } from '@/lib/despensa'
import { cookLabel } from '@/lib/jantar'
import { weekPriorities } from '@/lib/reuniao'
import { MeuDiaCard } from '@/components/meudia/MeuDia'
import { FaxinaoHomeCard } from '@/components/casa/Faxinao'
import { MascoteCard } from '@/components/Mascote'
import { SobrouCard } from '@/components/SobrouCard'
import { FoodLow } from '@/components/caes/DogPanels'
import { foodAlerts, foodLeftLabel, kindInfo } from '@/lib/caes'
import { bills as agBills, agendaEntries, kindIcon } from '@/lib/agenda'
import { fmtClock, remainingMs } from '@/lib/sprint'
import { firstName } from '@/components/AppModals'
import { StuckCard } from '@/components/nos/Esquecidas'
import { NewsCard } from '@/components/Guia'
import { DayDone } from '@/components/ui/Festa'
import { Deferred } from '@/components/ui/Deferred'
import type { App } from '@/components/app/useNinhoApp'

export function InicioScreen({ a }: { a: App }) {
  const { hItems, ownerOfItem, toggleTask, toggleDogItem, isPending, fx, adjustForgot, ajusteNotNow, stuckTasks, a11y, accidents, account, actionBtn, activeCh, ag, allToday, autoDistribute, buyFood, care, casa, challenge, chaos, ci, countFor, cx, dateLabel, dayPct, dogDaily, dogDone, dogName, dogs, doneToday, en, fxLive, game, go, goCasa, goMd, healthSoon, hello, helpReq, hiddenCount, homeView, householdId, itemTitle, lv, maintActions, mascot, md, mdAdd, me, names, newBag, nos, nowHM, nowSum, onb, openModal, person, personCard, pickHomeView, pickPerson, plan, rn, rnRun, saveCheckin, setA11y, setDayOpen, setNosView, setOnb, setShowAllToday, setSprintOpen, setTab, settings, setup, showAllToday, showCard, showError, showToast, sp, streak, today, todayIndex, toggleSurvival, week, weekInfo, weekStart, xp, xpPct } = a
  const [focus,setFocus]=useState(false)
  return (
    <div className="scr">
      {me&&<DayDone count={countFor(me)} today={today} name={firstName(names[me])}/>}
      <div className="sh">
        <div><h1>{hello}{me?`, ${firstName(names[me])}`:''} 👋</h1><p>{dateLabel}</p>
          <div className="hd-chips">
            {me&&<span className="chip"><span className={`mini av-${me}`} aria-hidden="true">{names[me].slice(0,1).toUpperCase()}</span>{account?'Sua conta':'Este aparelho'}</span>}
            <button className={`chip ${settings.survival?'coral':en.cls}`} onClick={()=>openModal('energy')} aria-label={`A semana: ${en.l}${settings.survival?', modo sobrevivência':''}. Alterar`}>{settings.survival?'🛡 Sobrevivência':`${en.ic} ${en.l}`}</button>
            {me&&<button className="chip" onClick={()=>setDayOpen(true)}>🗓️ Planejar o dia</button>}
            {fx.available&&<button className={`chip ${fxLive?'green':''}`} onClick={()=>goCasa('faxinao')}>🧹 {fxLive?'Faxinão em andamento':'Faxinão'}</button>}
          </div>
        </div>
        <div className="sh-a desk-only"><button className="btn btn-p" onClick={()=>openModal('task',null)}>+ Nova tarefa</button></div>
      </div>
      {setup?.available&&!setup.completed&&!onb&&!setupSnoozed(a11y,today)&&<div className="setup-cta">
        <span aria-hidden="true" style={{fontSize:24}}>🪺</span>
        <div><b>Configurar o Ninho</b><small>{(setup.progress?.step||1)>1?`Você parou na etapa ${setup.progress!.step} de ${LAST_STEP}. As respostas estão guardadas.`:'Uns 3 minutos para ajustar rotinas, essenciais e a aparência.'}</small></div>
        <button className="btn btn-p" onClick={()=>setOnb('open')}>{(setup.progress?.step||1)>1?'Continuar':'Começar'}</button>
        <button className="lnk-inline" onClick={()=>{setA11y({setupSnooze:addDays(today,14)});showToast('Ok! O aviso volta em 2 semanas. Dá para configurar a qualquer hora em Ajustes.')}}>Agora não</button>
      </div>}

      {showCard('resumo')&&<div className="qstats" role="group" aria-label="Resumo">
        <div className="qs"><span className="qs-l">Hoje</span><b>{dayPct}%</b><small>{doneToday}/{allToday.length}</small></div>
        <button className="qs" onClick={()=>setTab('week')}><span className="qs-l">Nível {lv.l}</span><b>{xp}</b><small>/ {lv.max} XP</small></button>
        <div className="qs" title={game.streaks.house_best>0?`Recorde: ${game.streaks.house_best} dias`:undefined}><span className="qs-l">Sequência</span><b>🔥 {streak}</b><small>dia{streak!==1?'s':''}</small></div>
        {activeCh?<button className="qs qs-ch" onClick={()=>{go('nos');setNosView('desafios')}}><span className="qs-l">Desafio · {activeCh.p.hits}/{activeCh.c.goal}{activeCh.p.todayHit?' ✓':''}</span><b className="qs-t">{activeCh.c.title}</b></button>
        :challenge&&nos.available?<button className="qs qs-ch" onClick={()=>{go('nos');setNosView('desafios')}}><span className="qs-l">Desafio sugerido</span><b className="qs-t">{challenge.title}</b></button>:null}
      </div>}
      {showCard('prioridades')&&(()=>{const pr=weekPriorities(nos.meetings,weekStart);return pr&&<section className="card prio" aria-labelledby="prio-h">
        <div className="slbl" id="prio-h">🎯 Prioridades da semana<button className="lnk" onClick={()=>{go('nos');setNosView('semana')}}>Reunião →</button></div>
        <ol className="prio-l">{pr.list.map((p,i)=><li key={i}>{p}</li>)}</ol>
        <p className="row-s">Combinadas na reunião de {fmtDate(addDays(pr.from,6))}.</p>
      </section>})()}

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
        <button className="fc foco-b" onClick={()=>setFocus(true)} aria-haspopup="dialog">🎯 Foco</button>
        <div className="seg-mini" role="radiogroup" aria-label="Como ver o dia">
          {([['lista','Lista'],['tempo','Linha do tempo']] as const).map(([k,l])=><button key={k} role="radio" aria-checked={homeView===k} className={homeView===k?'on':''} onClick={()=>pickHomeView(k)}>{l}</button>)}
        </div>
        <div className="now-s" aria-live="polite">
          {nowSum.late>0&&<span className="chip coral">⚠ {nowSum.late} atrasada{nowSum.late>1?'s':''}</span>}
          {nowSum.essentials>0&&<span className="chip">● {nowSum.essentials} essencia{nowSum.essentials>1?'is':'l'} pendente{nowSum.essentials>1?'s':''}</span>}
          {nowSum.next&&<span className="chip">▸ {itemTitle(nowSum.next)} às {hhmm(nowSum.next.scheduled_time)}</span>}
          {helpReq.length>0&&<button className="chip tag-help" onClick={()=>openModal('taskmenu',helpReq[0])}>🙋 {firstName(names[helpReq[0].help_by!])} pediu ajuda: {helpReq[0].title}{helpReq.length>1?` +${helpReq.length-1}`:''}</button>}
          {!nowSum.late&&!nowSum.essentials&&!nowSum.next&&!helpReq.length&&<span className="chip green">✓ Nada urgente{me?' para você':''}</span>}
        </div>
      </div>
      {focus&&(()=>{const f=focusList(hItems,me,ownerOfItem,nowHM);return <FocusSheet list={f.list} rest={f.rest} title={itemTitle}
        busy={i=>i.task?isPending('task:'+i.task.id):i.dog!.parts.some(x=>isPending('dog:'+x.r.id))}
        onDone={i=>i.task?toggleTask(i.task):toggleDogItem(i.dog!)} onMenu={i=>{setFocus(false);openModal('taskmenu',i.task)}} onClose={()=>setFocus(false)}/>})()}
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
          {showCard('mascote')&&<MascoteCard say={mascot} today={today}/>}
          {week.available&&me&&showCard('checkin')&&<CheckinCard me={me} names={names} today={week.checkins.filter(c=>c.date===today)} onSave={saveCheckin}/>}
          {fxLive&&<FaxinaoHomeCard f={fxLive} me={me} names={names} onOpen={()=>goCasa('faxinao')}/>}
          {md.available&&me&&showCard('meudia')&&<MeuDiaCard me={me} settings={md.settings} logs={md.logs} meds={md.meds} profiles={md.profiles} goals={md.goals}
            onUndo={l=>{md.remove(l).catch(e=>showError(toNinhoError(e,'desfazer')))}} today={today} nowHM={nowHM}
            onAdd={(k,v)=>{mdAdd(me,k,v).then(()=>{if(navigator.onLine!==false)showToast('+1 copo 💧')}).catch(e=>showError(toNinhoError(e,'registrar água')))}} onOpen={()=>goMd('hoje')}/>}
          {setup?.available&&showCard('rotina')&&rn.today.length>0&&<RoutineNowCard now={rn.now} next={rn.next} countToday={rn.today.length} names={names}
            turnOf={r=>turnBy('routine:'+r.id,'daily',today,plan.slots)} progress={r=>rnRun(r as Routine)} onOpen={()=>go('rotinas')} onSetup={()=>setOnb(setup.completed?'redo':'open')}/>}
          {showCard('caes')&&<div className="card">
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
            {foodAlerts(dogs,today,7).map(({dog,left})=><div key={dog.id} className={`care-i fl-home ${left<=2?'late':''}`}>
              <span>🍖 Ração da {dog.name}: <b>{foodLeftLabel(left)}</b></span>
              <FoodLow dog={dog} left={left} onBuyFood={buyFood} onNewBag={newBag}/>
            </div>)}
            {(care.length>0||healthSoon.some(r=>r.next_date!<=addDays(today,14)))&&<div className="care">
              <div className="care-l">Cuidados próximos</div>
              {healthSoon.filter(r=>r.next_date!<=addDays(today,14)).slice(0,4).map(r=><button key={r.id} className="care-i" onClick={()=>go('caes')}><span>{kindInfo(r.kind)[1]} {dogName(r.dog_id)}: {r.title}</span><span className={`mono ${r.late?'late':''}`}>{r.late?'atrasado':r.next_date===today?'hoje':fmtDate(r.next_date!)}</span></button>)}
              {care.slice(0,3).map(c=><button key={c.id} className="care-i" onClick={()=>goCasa('manutencao')}><span>{c.title}</span><span className={`mono ${c.next_due<today?'late':''}`}>{c.next_due<today?'atrasado':c.next_due===today?'hoje':fmtDate(c.next_due)}</span></button>)}
            </div>}
            {dogs.length>0&&<div style={{fontSize:11.5,color:'var(--sub)',marginTop:8}}>As rotinas aparecem na lista de quem é a vez ↻</div>}
          </div>}
          {cx.ready&&showCard('jantar')&&(()=>{const din=cx.meals.find(m=>m.date===today&&m.meal==='jantar');const soon=useSoon(cx.pantry,today);return (din||soon.length>0)&&(
            <div className="card jt-home">
              {din&&<div className="jt-home-d"><span>🍲 <b>Jantar de hoje:</b> {din.title}</span><button className="lnk" onClick={()=>goCasa('jantar')}>🍳 {cookLabel(din.cook,names)}</button></div>}
              {soon.length>0&&<div className="jt-home-d"><span>⏰ <b>Usar logo:</b> {soon.slice(0,3).map(i=>`${i.name} (${urgencyLabel(i,today)})`).join(', ')}{soon.length>3?` e mais ${soon.length-3}`:''}</span><button className="lnk" onClick={()=>goCasa('despensa')}>Despensa →</button></div>}
            </div>)})()}
          <Deferred>{ag.available&&showCard('agenda')&&(()=>{const soon=agendaEntries(ag.events,[],today,1).filter(e=>!e.late);const due=agBills(ag.events,today).pending.filter(b=>b.date<=addDays(today,3));return (soon.length>0||due.length>0)&&(
            <div className="card ag-home">
              <div className="slbl">📅 Agenda<button className="lnk" onClick={()=>goCasa('agenda')}>Ver →</button></div>
              {soon.map(e=><div key={e.key} className="ag-home-i"><span>{e.icon} {e.title}</span><span className="mono">{e.date===today?'hoje':'amanhã'}{e.time?` ${e.time}`:''}</span></div>)}
              {due.map(b=><div key={b.id} className={`ag-home-i ${b.date<today?'late':''}`}><span>{kindIcon('vencimento')} {b.title}</span><span className="mono">{b.date<today?'atrasado':b.date===today?'vence hoje':`vence ${fmtDate(b.date)}`}</span></div>)}
            </div>)})()}</Deferred>
          <Deferred>{showCard('sobrou')&&<SobrouCard householdId={householdId} today={today} link={ag.sobrouUrl} onGuide={()=>{go('ajustes');setTimeout(()=>document.getElementById('sobrou-guia')?.scrollIntoView({behavior:'smooth',block:'start'}),300)}}/>}</Deferred>
          <Deferred>{showCard('manutencao')&&<MaintTodayCard items={casa.maint} today={today} names={names} actions={maintActions} onOpen={()=>goCasa('manutencao')}/>}</Deferred>
          {showCard('compras')&&(()=>{const sc=shoppingCounts(casa.shop);return casa.shopState==='ready'&&sc.toBuy>0&&(
            <button className="card dsum shop-sum" onClick={()=>setTab('shop')}>
              <span className="dav" style={{width:36,height:36,fontSize:18}}>🛒</span>
              <span style={{flex:1,minWidth:0,textAlign:'left'}}><b>{sc.toBuy} ite{sc.toBuy===1?'m':'ns'} na lista de compras</b>
                <span className="dsum-s">{casa.shop.filter(i=>!i.checked_at).slice(0,4).map(i=>i.title).join(', ')}{sc.toBuy>4?'…':''}</span></span>
              <span className="chev">›</span>
            </button>)})()}
          <Deferred>{showCard('atalhos')&&<div className="card">
            <div className="slbl">Atalhos</div>
            <div className="fchips qa-chips">
              <button className="fc" onClick={autoDistribute}>✦ Distribuir tarefas</button>
              <button className="fc" onClick={()=>openModal('energy')}>{settings.survival?'🛡 Semana: sobrevivência':`${en.ic} Semana: ${en.l.toLowerCase()}`}</button>
              <button className="fc" onClick={()=>openModal('meeting')}>📋 Reunião semanal</button>
              {sp.available&&<button className="fc" onClick={()=>setSprintOpen(true)}>⏱ {sp.active?`Sprint · ${fmtClock(remainingMs(sp.active,sp.now))}`:'Sprint do Ninho'}</button>}
            </div>
          </div>}</Deferred>
        </aside>
      </div>
      <NewsCard onGuide={()=>{go('ajustes');setTimeout(()=>document.getElementById('aj-ajuda')?.scrollIntoView({behavior:'smooth',block:'start'}),400)}}/>
      {showCard('ajuste')&&stuckTasks.length>0&&<StuckCard task={stuckTasks[0]} more={stuckTasks.length-1} names={names} onAdjust={adjustForgot} onLater={()=>ajusteNotNow(stuckTasks[0])}/>}
      {week.available&&showCard('semana')&&<WeekStrip days={weekInfo} names={names}/>}
    </div>
  )
}
