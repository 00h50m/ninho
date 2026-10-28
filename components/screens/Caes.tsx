'use client'
// Cães: rotinas, escala, saúde, alimentação e filhote.
// O estado e as ações vêm de useNinhoApp (components/app/useNinhoApp.tsx).
import { toNinhoError } from '@/lib/errors'
import { Ring } from '@/components/ui/Ring'
import { DogScheduleCard } from '@/components/caes/Escala'
import * as cApi from '@/lib/services/caes'
import { DogAvatar, DogHealthBlock, PuppyPanel } from '@/components/caes/DogPanels'
import { type HealthKind } from '@/lib/caes'
import type { App } from '@/components/app/useNinhoApp'

export function CaesScreen({ a }: { a: App }) {
  const { addAccident, buyFood, cz, dogDaily, dogDone, dogRow, dogs, fixAccident, householdId, isPending, names, newBag, openModal, puppies, removeAccident, showError, showToast, today } = a
  return (
    <div className="scr">
      <div className="sh">
        <div><h2>Cães</h2><p>{dogs.length} pet{dogs.length!==1?'s':''}{dogDaily.length>0&&` · ${dogDone}/${dogDaily.length} rotinas hoje`}</p></div>
        <div className="sh-a"><button className="btn btn-s" onClick={()=>openModal('pet')}>+ Adicionar pet</button></div>
      </div>
      {dogs.length>0&&<DogScheduleCard ready={cz.planReady} plan={cz.dogPlan} names={names} today={today}
        routines={dogs.flatMap(d=>d.routines.filter(r=>r.frequency==='daily').map(r=>({title:r.title,scheduled_time:r.scheduled_time})))}
        onMode={async m=>{const prev=cz.dogPlan;cz.setDogPlan(p=>({...p,mode:m}))
          try{await cApi.setDogMode(householdId,m);showToast(m==='escala'?'Escala fixa dos cães ligada 📅':'Rotinas dos cães voltam a alternar ↻')}
          catch(e){cz.setDogPlan(prev);showError(toNinhoError(e,'mudar a divisão dos cães'));throw e}}}
        onCell={async(dow,period,who)=>{const prev=cz.dogPlan
          cz.setDogPlan(p=>({...p,cells:[...p.cells.filter(c=>!(c.dow===dow&&c.period===period)),...(who?[{dow,period,who}]:[])]}))
          try{await cApi.setScheduleCell(householdId,dow,period,who)}
          catch(e){cz.setDogPlan(prev);showError(toNinhoError(e,'salvar escala'));throw e}}}/>}
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
                  onRecord={(k:HealthKind)=>openModal('health',{dog,record:null,kind:k})} onEdit={r=>openModal('health',{dog,record:r,kind:r.kind})} onBuyFood={buyFood} onNewBag={newBag}/>}
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
    </div>
  )
}
