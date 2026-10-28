'use client'
// Casa: tarefas, compras, comida (despensa e jantar) e mais (manutenção, agenda, faxinão, sugestões).
// O estado e as ações vêm de useNinhoApp (components/app/useNinhoApp.tsx).
import { CAT, FPT, WPT } from '@/lib/constants'
import { Icon, SubTabs, type CasaView } from '@/components/shell/Shell'
import { fmtDate, hhmm } from '@/lib/dates'
import { doneInPeriod, lastDone, lastLabel, pausedOn, pausedToday, periodLabel, periodState, weekdaysLabel } from '@/lib/frequency'
import { isFixed } from '@/lib/rotation'
import { ShoppingTab } from '@/components/casa/ShoppingTab'
import { MaintenanceSection } from '@/components/casa/Maintenance'
import { shoppingCounts } from '@/lib/shopping'
import { XPW } from '@/lib/xp'
import { toNinhoError } from '@/lib/errors'
import { AgendaView } from '@/components/casa/Agenda'
import { AgendaCelular } from '@/components/casa/AgendaCelular'
import { SuggestionsView } from '@/components/casa/Sugestoes'
import { PantryView } from '@/components/casa/Despensa'
import { DinnerView } from '@/components/casa/Jantar'
import * as cxApi from '@/lib/services/despensaJantar'
import { useSoon } from '@/lib/despensa'
import { dinnersFromPantry } from '@/lib/jantar'
import * as mdApi from '@/lib/services/meudia'
import { CASA_GROUP, casaGroups, type CasaGroup } from '@/lib/nav'
import { FaxinaoView } from '@/components/casa/Faxinao'
import { bills as agBills } from '@/lib/agenda'
import { firstName, wCls, byCat, QuickTime } from '@/components/AppModals'
import type { App } from '@/components/app/useNinhoApp'

export function CasaScreen({ a }: { a: App }) {
  const { addPack, addSuggestion, ag, archiveTasks, archived, assignTask, billPaid, casa, casaLast, casaOk, casaView, cx, deleteTask, dogCareAgenda, dogTasks, dogs, eventDone, filtered, fx, fxLive, go, goCasa, householdId, maintActions, md, me, names, onShoppingFinished, openModal, ownerOfTask, pauseUntil, periodOk, query, quickUpdate, requireMe, restoreTask, saveSobrou, setCasaView, setQuery, setTaskFilter, setToast, showError, showToast, taskFilter, tasks, toastTimer, today, usedCats } = a
  return (
    <div className="scr">
      {(()=>{const groups=casaGroups([['tarefas','Tarefas',tasks.length],['compras','Compras',shoppingCounts(casa.shop).toBuy],['manutencao','Manutenção',casa.maint.filter(i=>i.next_due<=today).length],...(ag.available?[['agenda','Agenda',agBills(ag.events,today).overdue+ag.events.filter(e=>e.kind!=='vencimento'&&!e.done_at&&e.date<=today).length] as [CasaView,string,number]]:[]),...(fx.available?[['faxinao',fxLive?'Faxinão ▶':'Faxinão',fx.list.filter(f=>f.status==='rascunho'||f.status==='andamento').length] as [CasaView,string,number]]:[]),...(cx.ready?[['despensa','🥫 Despensa',useSoon(cx.pantry,today).length],['jantar','🍲 Jantar']] as [CasaView,string,number?][]:[]),['sugestoes','💡 Sugestões']]);const cur=CASA_GROUP[casaView];const grp=groups.find(x=>x.g===cur);return <>
        <SubTabs label="Áreas da Casa" value={cur} onChange={g=>{const gr=groups.find(x=>x.g===g)!;const last=casaLast.current[g];setCasaView(last&&gr.views.some(([v])=>v===last)?last:gr.views[0][0])}} options={groups.map(x=>[x.g,x.label,x.n] as [CasaGroup,string,number])}/>
        {grp&&grp.views.length>1&&<div className="fchips casa-sub" role="tablist" aria-label={grp.label.replace(/^\S+ /,'')}>{grp.views.map(([v,l,n])=><button key={v} role="tab" aria-selected={casaView===v} className={`fc ${casaView===v?'on':''}`} onClick={()=>setCasaView(v)}>{l}{!!n&&<span className="subtab-n">{n}</span>}</button>)}</div>}
      </>})()}
      {casaView==='despensa'?<PantryView ready={cx.ready} items={cx.pantry} history={casa.shopHistory} today={today} ideas={dinnersFromPantry(md.recipes,cx.pantry,today).length} onIdeas={()=>setCasaView('jantar')}
          onSave={x=>cxApi.savePantry(householdId,me,x).then(cx.reload).then(()=>showToast(x.id?'Item salvo':`🥫 ${x.name} na despensa`)).catch(e=>{showError(toNinhoError(e,'guardar na despensa'));throw e})}
          onRemove={it=>cxApi.removePantry(it.id).then(cx.reload).then(()=>showToast(`${it.name} saiu da despensa`)).catch(e=>{showError(toNinhoError(e,'tirar da despensa'));throw e})}
          onFinished={it=>cxApi.pantryToShopping(householdId,me,it).then(r=>{cx.reload();casa.reloadShopping();showToast(r.created?`🛒 ${it.name} na lista de compras`:`${it.name} já estava na lista`)}).catch(e=>{showError(toNinhoError(e,'mandar para compras'));throw e})}/>
      :casaView==='jantar'?<DinnerView ready={cx.ready} meals={cx.meals} recipes={md.recipes} pantry={cx.pantry} names={names} today={today}
          onSave={x=>cxApi.saveMeal(householdId,me,x).then(cx.reload).then(()=>showToast(`🍲 ${x.title} · ${fmtDate(x.date)}`)).catch(e=>{showError(toNinhoError(e,'planejar jantar'));throw e})}
          onDelete={m=>cxApi.deleteMeal(m.id).then(cx.reload).then(()=>showToast('Jantar tirado')).catch(e=>{showError(toNinhoError(e,'tirar jantar'));throw e})}
          onShopping={lines=>mdApi.menuToShopping(householdId,me,lines).then(r=>{casa.reloadShopping();showToast(`🛒 ${r.added} na lista de compras${r.had?` · ${r.had} já estava(m)`:''}`)}).catch(e=>{showError(toNinhoError(e,'mandar para compras'));throw e})}/>
      :casaView==='sugestoes'?<SuggestionsView taskTitles={tasks.map(t=>t.title)} petTitles={dogs.flatMap(d=>d.routines.map(r=>r.title))} hasDogs={dogs.length>0} archived={archived} names={names} onRestore={restoreTask} today={today} periodOk={periodOk} onAddPack={addPack}
          onAdd={addSuggestion} onCustomize={sg=>openModal('task',{title:sg.t,category:sg.cat,weight:sg.w,frequency:sg.f,essential:false,assigned_to:null,scheduled_time:null,active:true,id:null})}/>
      :casaView==='faxinao'?<FaxinaoView householdId={householdId} me={me} names={names} list={fx.list} available={fx.available} ready={fx.ready} reload={fx.reload} setList={fx.setList}
          onToast={m=>showToast(m)} onError={(e,c)=>showError(toNinhoError(e,c))}/>
      :casaView==='compras'?<ShoppingTab householdId={householdId} me={me} names={names} items={casa.shop} stores={casa.shopStores} history={casa.shopHistory} state={casa.shopState} error={casa.shopError}
        setItems={casa.setShop} onReload={casa.reloadShopping} extras={casa.shopExtras} requireMe={requireMe} toast={(m,u)=>showToast(m,u)} fail={(e,r)=>showError(e,r)} onFinished={onShoppingFinished}/>
      :casaView==='agenda'?<AgendaView available={ag.available} events={ag.events} maint={casa.maint} dogCare={dogCareAgenda} onOpenDogs={()=>go('caes')} today={today} names={names} sobrouUrl={ag.sobrouUrl}
        onNew={k=>openModal('event',{event:null,kind:k})} onEdit={e=>openModal('event',{event:e,kind:e.kind})} onDone={eventDone} onPaid={billPaid}
        onOpenMaint={()=>goCasa('manutencao')} onSaveSobrou={saveSobrou}
        footer={<AgendaCelular householdId={householdId} onToast={m=>showToast(m)} onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}/>}/>
      :casaView==='manutencao'?<>
        <div className="sh"><div><h2>Manutenção</h2><p>De tempos em tempos: casa, cães, carro e saúde</p></div></div>
        <MaintenanceSection items={casa.maint} log={casa.maintLog} today={today} names={names} state={casa.maintState} error={casa.maintError} actions={maintActions}
          onReload={()=>{casa.reloadMaintenance()}} onNew={()=>openModal('maint',null)} onEdit={it=>openModal('maint',it)} onTemplates={()=>openModal('mainttpl')}/>
      </>:<>
      <div className="sh">
        <div><h2>Tarefas</h2><p>{tasks.length} ativa{tasks.length!==1?'s':''} · toque numa tarefa para editar</p></div>
        <div className="sh-a">
          <button className="btn btn-s" onClick={()=>goCasa('sugestoes')}>✦ Sugestões</button>
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
        <div className="card empty"><span className="empty-icon">📋</span>Nenhuma tarefa cadastrada ainda<div><button className="btn btn-p" onClick={()=>goCasa('sugestoes')}>✦ Começar com sugestões</button></div></div>
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
                    {/* só o que tem valor: marcar essencial ou pôr horário fica no formulário (✎) */}
                    {t.essential&&<button className="bdg qb bdg-e" onClick={e=>{e.stopPropagation();quickUpdate(t.id,{essential:false})}} title="Tirar de essencial" aria-pressed={true}>● essencial</button>}
                    {t.scheduled_time&&<QuickTime value={hhmm(t.scheduled_time)} onSave={v=>quickUpdate(t.id,{scheduled_time:v||null})}/>}
                    {weekdaysLabel(t.weekdays)&&t.frequency!=='monthly'&&t.frequency!=='once'&&<span className="bdg bdg-t" title="Dias da semana">📆 {weekdaysLabel(t.weekdays)}</span>}
                    {t.frequency==='once'&&t.due_date&&<span className={`bdg ${t.due_date<today?'bdg-h':'bdg-t'}`} title="Data">📆 {fmtDate(t.due_date)}</span>}
                    {pausedOn(t,today)&&<button className="bdg qb bdg-n" onClick={e=>{e.stopPropagation();pauseUntil(t,null)}} title="Despausar" aria-label={`Pausada até ${fmtDate(t.paused_until!)}. Despausar ${t.title}`}>⏸ até {fmtDate(t.paused_until!)}</button>}
                    {t.frequency!=='once'&&periodLabel(t)&&(()=>{const st=periodState(t,today);return <span className={`bdg ${st?'bdg-n':'bdg-t'}`} title="Período">🗓 {st==='antes'?`começa ${fmtDate(t.starts_on!)}`:st==='depois'?`terminou ${fmtDate(t.ends_on!)}`:periodLabel(t)}</span>})()}
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
    </div>
  )
}
