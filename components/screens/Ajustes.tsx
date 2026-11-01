'use client'
// Ajustes: perfil, aparência, conforto, notificações, Telegram e a casa.
// O estado e as ações vêm de useNinhoApp (components/app/useNinhoApp.tsx).
import type { Who } from '@/lib/types'
import { ROLE } from '@/lib/constants'
import { THEMES, type ThemeId } from '@/lib/theme'
import { HOME_CARDS, TEXT_SIZES, isDarkTheme } from '@/lib/a11y'
import { LEVELS } from '@/lib/xp'
import { NotificationsCard } from '@/components/NotificationsCard'
import { TelegramCard } from '@/components/TelegramCard'
import { SobrouGuide } from '@/components/SobrouGuide'
import { firstName, initials } from '@/components/AppModals'
import { GuideContent } from '@/components/Guia'
import type { App } from '@/components/app/useNinhoApp'

export function AjustesScreen({ a }: { a: App }) {
  const { goMd, setNosView, a11y, account, ag, device, dogs, go, householdId, lv, me, names, openModal, pickTheme, setA11y, setOnb, setToast, setup, showCard, showToast, shownTheme, streak, tasks, theme, toastTimer, updateName, xp } = a
  return (
    <div className="scr narrow">
      <button className="back" onClick={()=>go('inicio')}>← Início</button>
      <div className="sh"><div><h2>Ajustes</h2><p>Tudo o que dá para configurar, num lugar só</p></div></div>
      <nav className="fchips aj-idx" aria-label="Partes dos Ajustes">
        {([['aj-aparencia','🎨 Aparência'],['aj-inicio','🏠 Início'],['aj-notif','🔔 Notificações'],['aj-tg','✈️ Telegram'],['aj-conta','👤 Conta'],['aj-casa','🏡 Casa'],['aj-ajuda','❓ Ajuda']] as const).map(([id,l])=>
          <button key={id} className="fc" onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}>{l}</button>)}
      </nav>
      <div className="card aj-sec" id="aj-aparencia" style={{marginBottom:14}}>
        <div className="slbl">Aparência</div>
        <div className="themes" role="radiogroup" aria-label="Tema">
          {THEMES.map(t=>(
            <button key={t.id} role="radio" aria-checked={!a11y.autoTheme&&theme===t.id} className={`theme-opt ${!a11y.autoTheme&&theme===t.id?'on':''}`} onClick={()=>pickTheme(t.id)}>
              <span className="theme-sw" aria-hidden="true">{t.swatch.map((c,i)=><i key={i} style={{background:c}}/>)}</span>
              <span><b>{t.name}</b><small>{t.desc}</small></span>
            </button>
          ))}
        </div>
        <div className="a11y-row">
          <div><div className="row-t">🌗 Tema automático</div><div className="row-s">Segue o claro/escuro do celular{a11y.autoTheme?` · agora: ${THEMES.find(t=>t.id===shownTheme)?.name}`:''}</div></div>
          <button className={`switch ${a11y.autoTheme?'on':''}`} role="switch" aria-checked={a11y.autoTheme} aria-label="Tema automático" onClick={()=>setA11y({autoTheme:!a11y.autoTheme})}/>
        </div>
        {a11y.autoTheme&&<div className="a11y-auto">
          <label className="onb-f"><span>De dia (claro)</span><select className="fi" value={a11y.lightTheme} onChange={e=>setA11y({lightTheme:e.target.value as ThemeId})}>{THEMES.filter(t=>!isDarkTheme(t.id)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="onb-f"><span>À noite (escuro)</span><select className="fi" value={a11y.darkTheme} onChange={e=>setA11y({darkTheme:e.target.value as ThemeId})}>{THEMES.filter(t=>isDarkTheme(t.id)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        </div>}
        <div className="a11y-row">
          <div><div className="row-t">🔠 Tamanho do texto</div><div className="row-s">Aumenta textos, botões e áreas de toque juntos</div></div>
          <div className="a11y-seg" role="radiogroup" aria-label="Tamanho do texto">{TEXT_SIZES.map(([k,l])=><button key={k} role="radio" aria-checked={a11y.size===k} className={`fc ${a11y.size===k?'on':''}`} onClick={()=>setA11y({size:k})}>{l}</button>)}</div>
        </div>
        <div className="a11y-row">
          <div><div className="row-t">◐ Alto contraste</div><div className="row-s">Textos mais escuros, bordas visíveis e foco mais grosso</div></div>
          <button className={`switch ${a11y.contrast?'on':''}`} role="switch" aria-checked={a11y.contrast} aria-label="Alto contraste" onClick={()=>setA11y({contrast:!a11y.contrast})}/>
        </div>
        <div className="a11y-row">
          <div><div className="row-t">🐢 Menos animação</div><div className="row-s">Desliga transições e animações (o celular também pode pedir isso)</div></div>
          <button className={`switch ${a11y.motion==='reduce'?'on':''}`} role="switch" aria-checked={a11y.motion==='reduce'} aria-label="Menos animação" onClick={()=>setA11y({motion:a11y.motion==='reduce'?'system':'reduce'})}/>
        </div>
        <div className="row-s" style={{marginTop:8}}>Tudo aqui vale só para este aparelho: cada uma escolhe o que é mais confortável.</div>
      </div>
      <div className="card aj-sec" id="aj-inicio" style={{marginBottom:14}}>
        <div className="slbl">O que aparece no Início</div>
        <div>
          <div className="row-s">Desmarque o que não usa. O resto continua nas outras áreas. Vale só para este aparelho.</div>          <div className="a11y-cards">{HOME_CARDS.map(([k,l])=><label key={k}><input type="checkbox" checked={showCard(k)} onChange={e=>setA11y({hidden:e.target.checked?a11y.hidden.filter(x=>x!==k):[...a11y.hidden,k]})}/>{l}</label>)}</div>
        </div>
      </div>
      {setup?.available&&<div className="card" style={{marginBottom:14}}>
        <div className="slbl">Configuração do Ninho</div>
        <div className="row-s" style={{marginBottom:10}}>{setup.completed?'Feita. Dá para refazer: rotinas que já existem não são duplicadas e nada é apagado.':'Ainda não feita: rotinas, essenciais, semana e aparência em 9 etapas.'}</div>
        <button className="btn btn-g" onClick={()=>setOnb(setup.completed?'redo':'open')}>{setup.completed?'Refazer configuração':'Configurar agora'}</button>
      </div>}
      <div className="card aj-sec" id="aj-conta" style={{marginBottom:14}}>
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
      <div id="aj-notif" className="aj-sec"/>
      <NotificationsCard householdId={householdId} me={me} names={names} onToast={m=>showToast(m)}
        onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}
        onNeedIdentity={()=>openModal('device')}/>
      <SobrouGuide householdId={householdId} link={ag.sobrouUrl}/>
      <div id="aj-tg" className="aj-sec"/>
      <TelegramCard householdId={householdId} me={me} names={names} onToast={m=>showToast(m)}
        onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}
        onNeedIdentity={()=>openModal('device')}/>
      <div className="card aj-sec" id="aj-casa" style={{marginBottom:14}}>
        <div className="slbl">Ajustes da casa</div>
        <div className="aj-links">
          <button className="aj-link" onClick={()=>{go('nos');setNosView('equilibrio')}}><span>⚖️ Divisão da carga</span><small>Divisão inteligente ou rodízio · Nós › Semana › Equilíbrio</small></button>
          <button className="aj-link" onClick={()=>go('caes')}><span>🐾 Escala dos cães</span><small>Quem cuida em cada período · Cães</small></button>
          <button className="aj-link" onClick={()=>goMd('ajustes')}><span>🌿 Meu dia: metas e privacidade</span><small>Água, sono, comida e o que a outra vê · Meu dia › Ajustes</small></button>
        </div>
      </div>
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
      <div className="card guide aj-sec" id="aj-ajuda">
        <div className="slbl">Guia do Ninho</div>
        <GuideContent names={names}/>
      </div>
    </div>
  )
}
