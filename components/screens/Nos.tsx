'use client'
// Nós: semana, desafios, álbum, histórico, presentes e equilíbrio.
// O estado e as ações vêm de useNinhoApp (components/app/useNinhoApp.tsx).
import { ENERGY } from '@/lib/constants'
import { SubTabs } from '@/components/shell/Shell'
import { addDays, fmtDate } from '@/lib/dates'
import { LEVELS } from '@/lib/xp'
import { toNinhoError } from '@/lib/errors'
import { StreaksCard } from '@/components/gamification/StreaksCard'
import { RetroCard } from '@/components/nos/Retro'
import { Achievements } from '@/components/gamification/Achievements'
import { BalanceCard } from '@/components/nos/Balanco'
import { AlbumView } from '@/components/nos/Album'
import { weekBalance } from '@/lib/balanco'
import * as nosApi from '@/lib/services/nos'
import { bothCheckinStreak } from '@/lib/nos'
import { ChallengeCard, ChallengesView, CheckinHistory, DayNoteCard, TimelineCard, TogetherCard } from '@/components/nos/NosViews'
import { CoupleMonthCard } from '@/components/nos/ResumoMes'
import { GiftsView } from '@/components/nos/Presentes'
import { firstName } from '@/components/AppModals'
import type { App } from '@/components/app/useNinhoApp'

export function NosScreen({ a }: { a: App }) {
  const { act, activeChs, ag, agenda, allRoutines, autoDistribute, balanced, casa, challenge, challengeStatus, createChallenge, cx, deleteChallenge, dogs, en, gP, gS, game, go, goCasa, historyData, historyError, householdId, isPending, lastMeeting, loadHistory, lv, markChallenge, maxHist, me, names, nos, nosTl, nosView, onAlbumError, openModal, rot, rotCount, routines, sS, saveSplit, setEnergy, setNosView, setToast, settings, showError, showToast, tasks, thisMeeting, thisMeetingRow, toastTimer, today, together, toggleAgreement, toggleSurvival, weekStart, xp, xpPct } = a
  return (
    <div className="scr">
      <div className="sh">
        <div><h2>Nós</h2><p>Semana de {fmtDate(weekStart)} · {en.l.toLowerCase()}</p></div>
        <div className="sh-a"><button className="btn btn-g" onClick={()=>openModal('meeting')}>📋 Reunião semanal</button><button className="btn btn-g" onClick={()=>go('ajustes')}>⚙️ Ajustes</button></div>
      </div>
      <SubTabs label="Nós" value={nosView} onChange={v=>setNosView(v)} options={[['semana','Semana'],['desafios','Desafios',activeChs.length],['historico','Histórico'],['equilibrio','Equilíbrio'],['presentes','🎁 Presentes'],['album','📸 Álbum']]}/>
      {nosView==='semana'&&<div className="wgrid">
        <div className="col">
          <TogetherCard {...together} xp={game.scores.g.xp+game.scores.s.xp} streak={nos.available?bothCheckinStreak(nos.facts.checkins,today):0} meetingDone={!!thisMeeting&&!!(thisMeeting.what_worked||thisMeeting.wins||thisMeeting.adjustments||(thisMeeting.agreements||[]).length)} onOpenMeeting={()=>openModal('meeting')}/>
          <BalanceCard names={names} thisWeek={weekBalance({tasks,dogs,meals:cx.meals,events:ag.events,anyDay:today,today})} lastWeek={weekBalance({tasks,dogs,meals:cx.meals,events:ag.events,anyDay:addDays(today,-7),today})}/>
          {nos.available&&me&&<DayNoteCard me={me} names={names} today={today} rows={nos.checkins} onSave={v=>nosApi.saveDayNote(householdId,today,me,v).then(()=>nos.reload()).then(()=>showToast('Registro salvo 📝')).catch(e=>{showError(toNinhoError(e,'salvar registro do dia'));throw e})}/>}
          {!nos.available&&nos.ready&&<div className="card empty"><span className="empty-icon">🤝</span>Registro do dia, desafios em dupla e combinados precisam da atualização do banco (migration 022).{nos.reason&&<div className="row-s" style={{marginTop:6}}>Detalhe: {nos.reason}</div>}</div>}
        </div>
        <div className="col">
          {nos.available&&<section className="card" aria-labelledby="ag-h">
            <div className="slbl" id="ag-h">Combinados {(thisMeetingRow?.agreements||[]).length>0?'desta semana':lastMeeting?.agreements?.length?'da semana passada':''}</div>
            {(()=>{const ws=(thisMeetingRow?.agreements||[]).length?weekStart:addDays(weekStart,-7);const list=(thisMeetingRow?.agreements||[]).length?thisMeetingRow!.agreements:(lastMeeting?.agreements||[])
              return list.length===0?<div className="row-s">Nenhum combinado ainda. Eles nascem na reunião semanal.</div>
              :<ul className="mt-agr-l">{list.map((a,i)=><li key={i}>
                <button className={`mt-chk ${a.done?'on':''}`} role="checkbox" aria-checked={a.done} aria-label={`Cumprido: ${a.text}`} onClick={()=>toggleAgreement(ws,list,i)}>{a.done?'✓':''}</button>
                <span className="mt-agr-t">{a.text}<small>{a.who==='both'?'as duas':firstName(names[a.who])}{a.task_id?' · é uma tarefa':''}</small></span></li>)}</ul>})()}
          </section>}
          {nos.available&&<section className="card" aria-labelledby="dc-h">
            <div className="slbl" id="dc-h">Desafios em dupla<button className="lnk" onClick={()=>setNosView('desafios')}>{activeChs.length?'Ver →':'Escolher →'}</button></div>
            {activeChs.length===0?<div className="row-s">Nenhum desafio agora. Que tal um de 7 dias?</div>
              :activeChs.slice(0,2).map(({c})=><ChallengeCard key={c.id} c={c} facts={nos.facts} today={today} names={names} compact onMark={markChallenge}/>)}
          </section>}
          {nos.available&&agenda.length>0&&<section className="card" aria-labelledby="pa-h">
            <div className="slbl" id="pa-h">Pauta da reunião<button className="lnk" onClick={()=>openModal('meeting')}>Abrir →</button></div>
            {agenda.slice(0,3).map(sec=><div key={sec.title} className="mt-sec"><div className="mt-sec-t">{sec.icon} {sec.title}</div><ul>{sec.lines.slice(0,3).map((l,i)=><li key={i}>{l}</li>)}</ul></div>)}
          </section>}
        </div>
      </div>}
      {nosView==='desafios'&&(nos.available?<ChallengesView challenges={nos.challenges} facts={nos.facts} today={today} names={names}
        routines={routines.map(r=>({id:r.id,title:r.title}))} habits={rot.habits.filter((h:any)=>!h.archived_at).map(h=>({id:h.id,title:h.title}))}
        suggestion={challenge||null} onCreate={v=>createChallenge({...v,created_by:me})} onMark={markChallenge} onStatus={challengeStatus} onDelete={deleteChallenge}/>
        :<div className="card empty"><span className="empty-icon">🤝</span>Desafios em dupla precisam da atualização do banco (migration 022).</div>)}
      {nosView==='album'&&<AlbumView householdId={householdId} me={me} names={names} today={today} marks={nosTl} onToast={m=>showToast(m)} onError={onAlbumError}/>}
      {nosView==='historico'&&<div className="wgrid">
        <div className="col">
          <CoupleMonthCard householdId={householdId} today={today} names={names} onToast={m=>showToast(m)}/>
          {nos.available&&<CheckinHistory rows={nos.checkins} names={names} today={today}/>}
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
        <div className="col">
          {nos.available&&<TimelineCard items={nosTl}/>}
          <RetroCard tasks={tasks} dogs={dogs} today={today} names={names}/>
          <StreaksCard streaks={game.streaks} names={names} me={me}/>
          <Achievements stats={game.stats} names={names} me={me}/>
        </div>
      </div>}
      {nosView==='presentes'&&(me?<div className="narrow"><GiftsView householdId={householdId} me={me} names={names} today={today} onToast={m=>showToast(m)}
        onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}/></div>
        :<div className="card empty"><span className="empty-icon">🎁</span>Escolha quem está usando este aparelho para ver a sua lista de presentes.</div>)}
      {nosView==='equilibrio'&&<div className="wgrid">
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
            <div style={{fontSize:12,color:'var(--sub)',marginTop:8,textAlign:'center'}}>Ou ajuste uma a uma em <button className="lnk-inline" onClick={()=>goCasa('tarefas')}>Casa › Tarefas →</button></div>
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
        </div>
      </div>}
    </div>
  )
}
