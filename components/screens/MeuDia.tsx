'use client'
// Meu dia: água, remédios, refeições, treino, sono e humor de quem está usando.
// O estado e as ações vêm de useNinhoApp (components/app/useNinhoApp.tsx).
import { toNinhoError } from '@/lib/errors'
import * as mdApi from '@/lib/services/meudia'
import { MeuDiaView } from '@/components/meudia/MeuDia'
import { planFoods } from '@/lib/dietPlan'
import type { App } from '@/components/app/useNinhoApp'

export function MeuDiaScreen({ a }: { a: App }) {
  const { casa, go, householdId, md, mdAdd, mdFocus, mdTab, me, names, nowHM, q, setMdTab, showError, showToast, today } = a
  return (
    <div className="scr">
      <div className="sh"><div><h2>Meu dia</h2><p>Água, sono, alimentação, treinos e corpo · só você vê o que não compartilhar</p></div></div>
      {me?<MeuDiaView available={md.available} reason={md.reason} me={me} names={names} today={today} nowHM={nowHM} settings={md.settings} logs={md.logs} meds={md.meds} quits={md.quits} quitsReady={md.quitsReady} tab={mdTab} onTab={setMdTab} focus={mdFocus} profiles={md.profiles} foods={md.foods} foodReady={md.foodReady} plans={md.plans} plansReady={md.plansReady} saved={md.saved} savedReady={md.savedReady} menus={md.menus} menusReady={md.menusReady} recipes={md.recipes} recipesReady={md.recipesReady} householdId={householdId} goals={md.goals} goalsReady={md.goalsReady}
        onCheckin={()=>{go('inicio');setTimeout(()=>document.getElementById('checkin')?.scrollIntoView({behavior:'smooth',block:'center'}),300)}}
        onSaveGoal={g=>mdApi.saveGoal(householdId,me,g).then(md.reload).then(()=>showToast(g.id?'Objetivo salvo':'Objetivo criado 🎯')).catch(e=>{showError(toNinhoError(e,'salvar objetivo'));throw e})}
        onGoalStatus={(g,st)=>mdApi.setGoalStatus(g.id,st).then(md.reload).then(()=>showToast(st==='concluido'?'Parabéns! Objetivo concluído 🎉':'Objetivo arquivado')).catch(e=>{showError(toNinhoError(e,'atualizar objetivo'));throw e})}
        onAdd={(k,v,d,dt)=>mdAdd(me,k,v,d,dt).catch(e=>{showError(toNinhoError(e,'registrar'));throw e})}
        onRemove={l=>md.remove(l).catch(e=>{showError(toNinhoError(e,'apagar registro'));throw e})}
        onSaveSettings={x=>mdApi.saveSettings(householdId,me,x).then(md.reload).then(()=>showToast('Salvo')).catch(e=>{showError(toNinhoError(e,'salvar'));throw e})}
        onSaveMed={m=>mdApi.saveMed(householdId,me,m).then(md.reload).then(()=>showToast('Remédio salvo')).catch(e=>{showError(toNinhoError(e,'salvar remédio'));throw e})}
        onStopMed={m=>mdApi.stopMed(m.id).then(md.reload).then(()=>showToast('Remédio encerrado')).catch(e=>{showError(toNinhoError(e,'encerrar remédio'));throw e})}
        onSaveQuit={q=>mdApi.saveQuit(householdId,me,q).then(md.reload).then(()=>showToast(q.id?'Salvo':'Contador começou hoje')).catch(e=>{showError(toNinhoError(e,'salvar hábito'));throw e})}
        onStopQuit={q=>mdApi.stopQuit(q.id).then(md.reload).then(()=>showToast('Encerrado')).catch(e=>{showError(toNinhoError(e,'encerrar hábito'));throw e})}
        onSaveProfile={x=>mdApi.saveFoodProfile(householdId,me,x).then(md.reload).then(()=>showToast('Meta salva')).catch(e=>{showError(toNinhoError(e,'salvar perfil'));throw e})}
        onSaveFood={f=>mdApi.saveFood(householdId,me,f).then(md.reload).then(()=>showToast('Alimento salvo')).catch(e=>{showError(toNinhoError(e,'salvar alimento'));throw e})}
        onStopFood={f=>mdApi.stopFood(f.id).then(md.reload).then(()=>showToast('Alimento removido')).catch(e=>{showError(toNinhoError(e,'remover alimento'));throw e})}
        onSavePlan={async(pl,src)=>{
          try{
            await mdApi.savePlan(householdId,me,pl,src)
            // cada alimento do plano entra em "Meus alimentos", com a porção e as calorias, para combinar as refeições
            const n=await mdApi.saveFoods(householdId,me,planFoods(pl,md.foods.filter(f=>f.who===me))).catch(()=>0)
            await md.reload()
            showToast(n?`Plano salvo · ${n} alimento(s) em Meus alimentos 🥗`:'Plano salvo')
          }catch(e){showError(toNinhoError(e,'salvar plano'));throw e}
        }}
        onSaveMeal={m=>mdApi.saveMeal(householdId,me,m).then(md.reload).then(()=>showToast(m.id?'Refeição salva atualizada ⭐':'Refeição salva ⭐ Lance com um toque quando quiser')).catch(e=>{showError(toNinhoError(e,'salvar refeição'));throw e})}
        onStopMeal={m=>mdApi.stopMeal(m.id).then(md.reload).then(()=>showToast('Refeição removida das salvas')).catch(e=>{showError(toNinhoError(e,'remover refeição salva'));throw e})}
        onUseMeal={m=>{mdApi.countMealUse(m.id,m.uses).then(md.reload).catch(()=>{})}}
        onSaveRecipe={r=>mdApi.saveRecipe(householdId,me,r).then(md.reload).then(()=>showToast(r.id?'Receita salva':'Receita salva 📖')).catch(e=>{showError(toNinhoError(e,'salvar receita'));throw e})}
        onStopRecipe={r=>mdApi.stopRecipe(r.id).then(md.reload).then(()=>showToast('Receita removida')).catch(e=>{showError(toNinhoError(e,'remover receita'));throw e})}
        onRecipeToShopping={lines=>mdApi.menuToShopping(householdId,me,lines).then(r=>{casa.reloadShopping();showToast(`🛒 ${r.added} na lista de compras${r.had?` · ${r.had} já estava(m)`:''}`)}).catch(e=>{showError(toNinhoError(e,'mandar para compras'));throw e})}
        onSaveFoods={list=>mdApi.saveFoods(householdId,me,list).then(md.reload).then(()=>showToast(`${list.length} alimento(s) em Meus alimentos 🥗`)).catch(e=>{showError(toNinhoError(e,'lançar alimentos'));throw e})}
        onSaveMenu={(start,menu,prefs)=>mdApi.saveMenu(householdId,me,start,menu,prefs).then(md.reload).then(()=>showToast('Cardápio da semana pronto 🗓️')).catch(e=>{showError(toNinhoError(e,'salvar cardápio'));throw e})}
        onStopMenu={m=>mdApi.stopMenu(m.id).then(md.reload).then(()=>showToast('Cardápio apagado')).catch(e=>{showError(toNinhoError(e,'apagar cardápio'));throw e})}
        onMenuToShopping={lines=>mdApi.menuToShopping(householdId,me,lines).then(r=>{casa.reloadShopping();showToast(`🛒 ${r.added} na lista de compras${r.had?` · ${r.had} já estava(m)`:''}`)}).catch(e=>{showError(toNinhoError(e,'mandar para compras'));throw e})}
        onUpdateMenu={(m,menu)=>mdApi.updateMenu(m.id,menu).then(md.reload).then(()=>showToast('Refeição trocada ↻')).catch(e=>{showError(toNinhoError(e,'trocar refeição'));throw e})}
        onImportFoods={list=>mdApi.saveFoods(householdId,me,list).then(md.reload).then(()=>{const r=list.filter(x=>x.review).length;showToast(`${list.length} alimento(s) importado(s)${r?` · ${r} para conferir`:''} 🥗`)}).catch(e=>{showError(toNinhoError(e,'importar alimentos'));throw e})}
        onPlanRemind={(r,on)=>mdApi.setPlanRemind(r.id,on).then(md.reload).then(()=>showToast(on?'Lembretes das refeições ligados':'Lembretes desligados')).catch(e=>{showError(toNinhoError(e,'lembretes do plano'));throw e})}
        onStopPlan={r=>mdApi.stopPlan(r.id).then(md.reload).then(()=>showToast('Plano removido')).catch(e=>{showError(toNinhoError(e,'remover plano'));throw e})}/>
        :<div className="card empty"><span className="empty-icon">💧</span>Escolha quem está usando este aparelho para ver o seu Meu dia.</div>}
    </div>
  )
}
