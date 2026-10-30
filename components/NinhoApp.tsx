'use client'
// Casca do app: navegação, cabeçalho, avisos, modais e a tela atual.
// O estado e as ações ficam em components/app/useNinhoApp.tsx; cada tela em components/screens/.
import type { Task, Who } from '@/lib/types'
import { BottomNav, Icon, QuickActionsSheet, SideNav } from '@/components/shell/Shell'
import { fmtDate, timeOfInstant } from '@/lib/dates'
import { pausedOn } from '@/lib/frequency'
import { whyLabel } from '@/lib/split'
import { MaintenanceForm, MaintTemplatesSheet } from '@/components/casa/Maintenance'
import { toNinhoError } from '@/lib/errors'
import { Sheet } from '@/components/ui/Sheet'
import { DeviceIdentityModal } from '@/components/DeviceIdentityModal'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { HabitEditor, RoutineEditor, TemplatesSheet } from '@/components/rotinas/Editors'
import { SprintPanel } from '@/components/sprint/SprintPanel'
import { EventSheet } from '@/components/casa/Agenda'
import { AguaPopup } from '@/components/meudia/AguaPopup'
import { Busca } from '@/components/Busca'
import type { SearchItem } from '@/lib/search'
import { type MdTab } from '@/lib/nav'
import { OrganizarDiaSheet } from '@/components/OrganizarDia'
import { PerguntarSheet } from '@/components/Perguntar'
import { DogProfileSheet, HealthSheet } from '@/components/caes/DogPanels'
import { areaLabel, fmtClock, remainingMs } from '@/lib/sprint'
import { firstName, initials, TaskFormModal, PauseSheet, PetModal, DogModal, RoutineModal, EnergyModal, MeetingModal } from '@/components/AppModals'
import { useNinhoApp, type Account } from '@/components/app/useNinhoApp'
import { InicioScreen } from '@/components/screens/Inicio'
import { MeuDiaScreen } from '@/components/screens/MeuDia'
import { RotinasScreen } from '@/components/screens/Rotinas'
import { CasaScreen } from '@/components/screens/Casa'
import { NosScreen } from '@/components/screens/Nos'
import { CaesScreen } from '@/components/screens/Caes'
import { AjustesScreen } from '@/components/screens/Ajustes'

export type { Account }

export default function NinhoApp({householdId,account}:{householdId:string,account?:Account}){
  const a=useNinhoApp({householdId,account})
  const {SKIP_LABEL,adjustForgot,retroForgot,addHouseTemplate,addMaintTemplates,addRoutineTemplate,ag,agenda,aguaPop,archiveHabit,archiveRoutine,askHelp,askOpen,busca,casa,casaOk,casaView,closeModal,createDay,data,dayOpen,deleteEvent,deleteHealth,deleteHouseTemplate,deleteTask,device,dogs,en,eventDone,fabAway,finishSprint,go,goMd,handoffToday,loadSetup,lv,md,mdAdd,mdTab,me,modal,modalData,names,nos,nowHM,onb,openModal,outbox,ownerOfTask,pauseOk,pauseSprint,pauseTask,pauseUntil,periodOk,pickSearch,pickTheme,plan,quickActions,removeDog,removeMaint,removeRoutine,rot,routines,saveEvent,saveHabitDraft,saveHealth,saveMaint,saveMeeting,savePet,saveRoutine,saveRoutineDraft,saveRoutineTemplate,saveTask,saving,screen,sendOutbox,setAskOpen,setBusca,setDayOpen,setEnergy,setOnb,setSprintOpen,setSprintTasks,setToast,settings,setup,showError,showToast,sp,spBusy,sprintOpen,startSprint,streak,swapTask,tasks,theme,thisMeeting,toast,today,toggleSurvival,toggleTask,tplBusy,undoHandoff,updateDog,weekStart,xp}=a
  return(
    <>

      <SideNav current={screen} onGo={go} onQuick={()=>openModal('quick')} sub={md.available&&me?{current:mdTab,onGo:(t:string)=>goMd(t as MdTab)}:undefined}
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
            <button className="ib top-search" onClick={()=>setBusca(true)} aria-label="Buscar no Ninho" title="Buscar (Ctrl+K)">🔍</button>
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
        {outbox.length>0&&<div className="banner low" role="status">📤 <span>{outbox.length} aç{outbox.length>1?'ões feitas':'ão feita'} sem internet guardada{outbox.length>1?'s':''} neste aparelho. Envia sozinho quando a conexão voltar.</span>
          <button className="lnk" onClick={()=>sendOutbox()}>Enviar agora</button></div>}
        {data.status==='ready'&&<>
        {/* ── HOJE ── */}
        {screen==='inicio'&&<InicioScreen a={a}/>}

        {/* ── ROTINAS ── */}
        {/* ── MEU DIA (de cada uma) ── */}
        {screen==='eu'&&<MeuDiaScreen a={a}/>}

        {screen==='rotinas'&&<RotinasScreen a={a}/>}

        {/* ── CASA ── */}
        {screen==='casa'&&<CasaScreen a={a}/>}


        {/* ── SEMANA ── */}
        {screen==='nos'&&<NosScreen a={a}/>}

        {/* ── CÃES ── */}
        {screen==='caes'&&<CaesScreen a={a}/>}

        {/* ── AJUSTES ── */}
        {screen==='ajustes'&&<AjustesScreen a={a}/>}
        </>}
      </main>

      {/* NAV MOBILE */}
      </div>
      <BottomNav current={screen} onGo={go}/>

      {data.status==='ready'&&screen!=='ajustes'&&!(screen==='casa'&&casaView==='compras')&&<button className={`fab mob-fab ${fabAway?'fab-away':''}`} onClick={()=>openModal('quick')} aria-label="Ação rápida" tabIndex={fabAway?-1:undefined}><Icon name="plus" size={24}/></button>}
      {modal==='quick'&&<QuickActionsSheet onClose={closeModal} actions={quickActions}/>}
      {askOpen&&me&&<PerguntarSheet householdId={householdId} me={me} onClose={()=>setAskOpen(false)}/>}
      {dayOpen&&me&&<OrganizarDiaSheet householdId={householdId} me={me} names={names} today={today} onClose={()=>setDayOpen(false)} onCreate={createDay}/>}

      {md.available&&me&&<AguaPopup key={aguaPop} me={me} today={today} nowHM={nowHM} settings={md.settings} logs={md.logs} force={aguaPop>0}
        onAdd={ml=>mdAdd(me,'agua',ml).then(()=>showToast(`💧 +${ml} ml`)).catch(e=>{showError(toNinhoError(e,'registrar água'));throw e})}
        onUndo={l=>md.remove(l).catch(e=>{showError(toNinhoError(e,'desfazer'));throw e})} onClose={()=>{}}/>}
      {busca&&<Busca onClose={()=>setBusca(false)} onPick={pickSearch} items={([] as SearchItem[]).concat(
        tasks.filter((t:any)=>t.active!==false).map((t:any)=>({kind:'tarefa' as const,id:t.id,title:t.title,sub:t.assigned_to?firstName(names[t.assigned_to as Who]):undefined})),
        (casa.shop||[]).map((i:any)=>({kind:'compra' as const,id:i.id,title:i.title,sub:[i.qty,i.checked_at?'no carrinho':null].filter(Boolean).join(' · ')||undefined})),
        (ag.events||[]).map((e:any)=>({kind:'agenda' as const,id:e.id,title:e.title,sub:`${e.date.slice(8,10)}/${e.date.slice(5,7)}${e.time?` às ${String(e.time).slice(0,5)}`:''}`})),
        (rot.routines||[]).map((r:any)=>({kind:'rotina' as const,id:r.id,title:r.title})),
        (dogs||[]).map((d:any)=>({kind:'cao' as const,id:d.id,title:d.name})),
        me?md.foods.filter(f=>f.who===me).map(f=>({kind:'alimento' as const,id:f.id,title:f.name,sub:`${f.portion} · ${Math.round(f.kcal)} kcal`})):[],
        me?md.saved.filter(x=>x.who===me).map(x=>({kind:'salva' as const,id:x.id,title:x.name,sub:`${Math.round(x.kcal)} kcal`})):[],
      )}/>}
      {toast&&<div className={`toast ${toast.kind==='err'?'err':''}`} role={toast.kind==='err'?'alert':'status'}>
        <span className="toast-m">{toast.msg}</span>
        {toast.undo&&<button onClick={toast.undo}>Desfazer</button>}
        {toast.retry&&<button onClick={()=>{const r=toast.retry!;setToast(null);r()}}>Tentar novamente</button>}
        {toast.kind==='err'&&<button className="tx" onClick={()=>setToast(null)} aria-label="Fechar aviso">✕</button>}
      </div>}
      {modal==='task'&&<TaskFormModal task={modalData} names={names} saving={saving} casaOk={casaOk} periodOk={periodOk} pauseOk={pauseOk} onClose={closeModal} onSave={saveTask} onDelete={deleteTask}/>}
      {modal==='pause'&&<PauseSheet task={modalData} today={today} onClose={closeModal} onPause={d=>{const t=modalData;closeModal();pauseUntil(t,d)}}/>}
      {modal==='pet'&&<PetModal saving={saving} onClose={closeModal} onSave={savePet}/>}
      {modal==='taskmenu'&&(()=>{const t:Task=modalData;const other:Who=ownerOfTask(t)==='g'?'s':'g';const why=whyLabel(plan.whyOf(t.id),names,today);return(
        <Sheet size="sm" title={t.title} onClose={closeModal}>
          {why&&<div className="why">↻ {why}</div>}
          {(()=>{const cf=plan.conflictOf(t.id);return cf&&!t.completed_today&&<div className="why cf" role="note">⚠ No horário de {cf.title} ({cf.start}–{cf.end}) da {firstName(names[cf.who])}. Passe só hoje, deixe para amanhã ou mude o horário.</div>})()}
          <div className="menu">
            <button className="btn btn-s" onClick={()=>{closeModal();toggleTask(t)}}>{t.completed_today?'↺ Desmarcar':'✓ Concluir'}</button>
            {!t.completed_today&&t.frequency!=='daily'&&<button className="btn btn-g" onClick={()=>{closeModal();pauseTask(t,'snooze')}}>⏭ Deixar para amanhã</button>}
            {!t.completed_today&&SKIP_LABEL[t.frequency]&&<button className="btn btn-g" onClick={()=>{closeModal();pauseTask(t,'skip')}}>⤼ {SKIP_LABEL[t.frequency]}<small className="menu-s">sem XP · não quebra a sequência</small></button>}
            {!t.completed_today&&(t.handoff&&t.handoff.date===today
              ?<button className="btn btn-g" onClick={()=>{closeModal();undoHandoff(t)}}>↩ Desfazer: volta para {firstName(names[t.handoff.to==='g'?'s':'g'])} hoje</button>
              :<button className="btn btn-g" onClick={()=>{closeModal();handoffToday(t)}}>↪ Só hoje com {firstName(names[other])}<small className="menu-s">amanhã volta ao normal</small></button>)}
            <button className="btn btn-g" onClick={()=>{closeModal();swapTask(t)}}>⇄ Passar para {firstName(names[other])} de vez</button>
            {casaOk&&!t.completed_today&&(t.help_by
              ?<button className="btn btn-g" onClick={()=>{closeModal();askHelp(t,false)}}>🙋 Cancelar pedido de ajuda</button>
              :<button className="btn btn-g" onClick={()=>{closeModal();askHelp(t,true)}}>🙋 Pedir ajuda a {firstName(names[other])}<small className="menu-s">ela vê o pedido na hora</small></button>)}
            {pauseOk&&(pausedOn(t,today)
              ?<button className="btn btn-g" onClick={()=>{closeModal();pauseUntil(t,null)}}>▶ Despausar<small className="menu-s">pausada até {fmtDate(t.paused_until!)}</small></button>
              :<button className="btn btn-g" onClick={()=>openModal('pause',t)}>⏸ Pausar por um tempo<small className="menu-s">viagem, obra, época do ano</small></button>)}
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
      {modal==='meeting'&&<MeetingModal householdId={householdId} names={names} weekStart={weekStart} saving={saving} initial={thisMeeting} agenda={nos.available?agenda:undefined} forgot={retroForgot} onAdjust={adjustForgot} agreementsOk={nos.available} onClose={closeModal} onSave={saveMeeting}/>}
    </>
  )
}
