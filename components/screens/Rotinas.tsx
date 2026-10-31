'use client'
// Rotinas com passos (Casa › Tarefas › Rotinas) e hábitos (Meu dia › Hábitos).
// O estado e as ações vêm de useNinhoApp (components/app/useNinhoApp.tsx).
import { FPT } from '@/lib/constants'
import { hhmm } from '@/lib/dates'
import { RoutinesView } from '@/components/rotinas/RoutinesView'
import { HabitsView } from '@/components/rotinas/HabitsView'
import { firstName } from '@/components/AppModals'
import type { App } from '@/components/app/useNinhoApp'

export function RotinasPanel({ a }: { a: App }) {
  const { finishRoutine, go, goCasa, me, names, openModal, ownerOfRoutine, rot, routineGroups, routineTurn, routines, settings, stepRoutine, today } = a
  return (
    <>
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
    </>
  )
}

export function HabitosPanel({ a }: { a: App }) {
  const { me, names, openModal, rot, today, toggleHabit } = a
  return <HabitsView habits={rot.habits} logs={rot.logs} available={rot.checklistOk} today={today} me={me} names={names}
        onToggle={toggleHabit} onEdit={h=>openModal('hbedit',{habit:h})} onNew={()=>openModal('hbedit',{habit:null})}
        onSuggest={sg=>openModal('hbedit',{habit:null,preset:{title:sg.title,owner:sg.owner,weekly_target:sg.weekly_target,weekdays:sg.weekdays}})}/>
}
