'use client'
// Rotinas e hábitos.
// O estado e as ações vêm de useNinhoApp (components/app/useNinhoApp.tsx).
import { FPT } from '@/lib/constants'
import { SubTabs } from '@/components/shell/Shell'
import { hhmm } from '@/lib/dates'
import { routineOnDay } from '@/lib/rotinas'
import { RoutinesView } from '@/components/rotinas/RoutinesView'
import { HabitsView } from '@/components/rotinas/HabitsView'
import { firstName } from '@/components/AppModals'
import type { App } from '@/components/app/useNinhoApp'

export function RotinasScreen({ a }: { a: App }) {
  const { finishRoutine, go, goCasa, me, names, openModal, ownerOfRoutine, rot, rotView, routineGroups, routineTurn, routines, setRotView, settings, stepRoutine, today, toggleHabit } = a
  return (
    <div className="scr">
      <div className="sh"><div><h2>Rotinas</h2><p>Rotinas com passos e hábitos para ganhar constância</p></div></div>
      <SubTabs label="Rotinas e hábitos" value={rotView} onChange={v=>setRotView(v)} options={[['rotinas','Minhas rotinas',routines.filter(r=>routineOnDay(r,today)).length],['habitos','Hábitos',rot.habits.length]]}/>
      {rotView==='rotinas'?<>
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
    </div>
  )
}
