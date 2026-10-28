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
import type { App } from '@/components/app/useNinhoApp'

export function AjustesScreen({ a }: { a: App }) {
  const { a11y, account, ag, device, dogs, go, householdId, lv, me, names, openModal, pickTheme, setA11y, setOnb, setToast, setup, showCard, showToast, shownTheme, streak, tasks, theme, toastTimer, updateName, xp } = a
  return (
    <div className="scr narrow">
      <button className="back" onClick={()=>go('nos')}>← Nós</button>
      <div className="sh"><div><h2>Ajustes</h2><p>Aparência, conta, integrantes e guia de uso</p></div></div>
      <div className="card" style={{marginBottom:14}}>
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
        <div className="a11y-row" style={{display:'block'}}>
          <div className="row-t">🏠 O que aparece no Início</div><div className="row-s">Desmarque o que não usa. O resto continua nas outras áreas.</div>
          <div className="a11y-cards">{HOME_CARDS.map(([k,l])=><label key={k}><input type="checkbox" checked={showCard(k)} onChange={e=>setA11y({hidden:e.target.checked?a11y.hidden.filter(x=>x!==k):[...a11y.hidden,k]})}/>{l}</label>)}</div>
        </div>
        <div className="row-s" style={{marginTop:8}}>Tudo aqui vale só para este aparelho: cada uma escolhe o que é mais confortável.</div>
      </div>
      {setup?.available&&<div className="card" style={{marginBottom:14}}>
        <div className="slbl">Configuração do Ninho</div>
        <div className="row-s" style={{marginBottom:10}}>{setup.completed?'Feita. Dá para refazer: rotinas que já existem não são duplicadas e nada é apagado.':'Ainda não feita: rotinas, essenciais, semana e aparência em 9 etapas.'}</div>
        <button className="btn btn-g" onClick={()=>setOnb(setup.completed?'redo':'open')}>{setup.completed?'Refazer configuração':'Configurar agora'}</button>
      </div>}
      <div className="card" style={{marginBottom:14}}>
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
      <NotificationsCard householdId={householdId} me={me} names={names} onToast={m=>showToast(m)}
        onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}
        onNeedIdentity={()=>openModal('device')}/>
      <SobrouGuide householdId={householdId} link={ag.sobrouUrl}/>
      <TelegramCard householdId={householdId} me={me} names={names} onToast={m=>showToast(m)}
        onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}
        onNeedIdentity={()=>openModal('device')}/>
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
      <div className="card guide">
        <div className="slbl">Guia do Ninho</div>
        <details open><summary>☀️ Hoje</summary><div className="gb">
          <p>A tela do dia. Cada uma tem sua coluna (no celular, troque pelo seletor no topo) com o anel de progresso e só o que está pendente <b>hoje</b>.</p>
          <ul>
            <li><b>Grupos por horário:</b> ⚠ Atrasadas (diárias com horário que já passou), 🌅 Manhã, ☀️ Tarde, 🌙 Noite, a qualquer hora e, por fim, as do período (até o fim da semana, quinzena ou mês) e as pontuais.</li>
            <li><b>▸ próxima</b> destaca a próxima tarefa com horário.</li>
            <li>Toque na tarefa para concluir. Aparece <b>+XP · Desfazer</b> por alguns segundos. As concluídas ficam recolhidas no fim da coluna, com <b>quem concluiu</b> (conclusões anteriores a esta versão aparecem como “não identificado”).</li>
            <li><b>Sua conta</b> (e-mail e senha) diz quem está usando o celular; é isso que fica registrado ao concluir. Ver a coluna da outra pessoa não muda isso. Se o banco recusar uma alteração, o app desfaz na tela e mostra o aviso com “Tentar novamente”.</li>
            <li>No computador, <b>⇄</b> passa para a outra e <b>✎</b> edita. No celular, tudo isso fica no <b>⋯</b>.</li>
            <li>Indicadores do topo: % do dia, estado da <b>Casa</b> (quanto das diárias ainda falta: organizada, atenção ou alerta), nível/XP e sequência.</li>
          </ul>
        </div></details>
        <details><summary>📋 Tarefas</summary><div className="gb">
          <p>A lista completa, agrupada por cômodo, com busca e filtros (essenciais, por pessoa, rodízio, sem horário e por cômodo).</p>
          <ul>
            <li><b>Ajuste rápido:</b> toque em “○ essencial” para ligar/desligar e em “+ horário” para definir a hora — sem abrir o formulário.</li>
            <li><b>Responsável:</b> escolha {firstName(names.g)}, {firstName(names.s)} ou ↻ rodízio direto no card.</li>
            <li>Toque no nome para editar tudo (cômodo, esforço, frequência, horário) ou remover.</li>
            <li><b>✦ Sugestões:</b> listas prontas por cômodo; selecione várias ou toque em ✎ para ajustar antes de criar.</li>
          </ul>
        </div></details>
        <details><summary>📅 Frequência</summary><div className="gb">
          <ul>
            <li><b>Diária:</b> volta todo dia.</li>
            <li><b>Semanal:</b> aparece até ser feita; depois some até a próxima segunda.</li>
            <li><b>Quinzenal:</b> uma vez a cada duas semanas (blocos fixos de 2 semanas).</li>
            <li><b>Mensal:</b> uma vez por mês do calendário.</li>
            <li><b>Pontual:</b> feita uma vez, some de vez.</li>
          </ul>
          <p>Cada tarefa mostra quando foi feita pela última vez (“há 9 dias”, “nunca feita”). Só dá para desmarcar o que foi feito hoje.</p>
          <ul>
            <li><b>📆 Dias da semana</b> (no formulário da tarefa): a diária aparece só nesses dias (ex.: lixo seg, qua e sex). A semanal ou quinzenal aparece a partir do primeiro dia escolhido (ex.: faxina a partir de sábado).</li>
            <li><b>Pontual com data:</b> aparece em Hoje a partir da data e fica em ⚠ Atrasadas se passar.</li>
            <li><b>⤼ Pular</b> (no ⋯ da tarefa, ou ⏭ no computador): resolve o dia, a semana ou o mês sem XP e <b>sem quebrar a sequência</b>. <b>⏭ Deixar para amanhã:</b> some só hoje. As puladas ficam no fim da coluna com “↺ Voltar”.</li>
          </ul>
        </div></details>
        <details><summary>↻ Divisão das tarefas</summary><div className="gb">
          <p>Tarefas sem responsável fixa (↻) são divididas entre vocês. Escolha o jeito em <b>Semana › Divisão da carga</b>:</p>
          <ul>
            <li><b>✦ Inteligente</b> (padrão): <b>quem fez por último passa a vez</b>. Se uma cobriu a outra, a vez se ajusta sozinha. Se uma já está com bem mais carga (o que é fixo dela + o que fez na semana), a próxima vai para a outra. Diárias são decididas a cada dia; semanais, quinzenais e mensais uma vez por período, para não trocarem de dona no meio da semana.</li>
            <li><b>↻ Rodízio fixo:</b> alterna sempre na mesma ordem (a cada dia, semana ou mês).</li>
          </ul>
          <p>No celular, toque em <b>⋯</b> numa tarefa para ver <b>por que é a vez de quem</b>. A conta é a mesma nos dois celulares e no bom dia.</p>
          <p>Usar ⇄ numa tarefa de rodízio fixa ela com a outra pessoa (dá para desfazer).</p>
          <p>Em <b>Semana › Divisão da carga</b> vocês veem os pontos de cada uma (esforço × frequência; rodízio conta metade para cada). <b>✦ Distribuir automaticamente</b> reparte tudo de forma equilibrada — atenção: ele define responsável fixo para todas e tira do rodízio.</p>
        </div></details>
        <details><summary>🛒 Compras</summary><div className="gb">
          <ul>
            <li>Lista compartilhada <b>ao vivo</b>: o que uma adiciona ou risca aparece na hora no celular da outra.</li>
            <li>Digite com a quantidade (“2 kg arroz”, “leite 3”) e a categoria é escolhida sozinha (dá para trocar). A lista fica na ordem dos corredores do mercado.</li>
            <li>Item repetido não duplica; se estava riscado, volta para a lista.</li>
            <li>No mercado, toque para riscar. <b>Finalizar compra</b> tira os riscados (com Desfazer) e oferece marcar a tarefa “Mercado semanal”.</li>
            <li><b>Comprar de novo:</b> os itens mais comprados nos últimos meses, a um toque.</li>
          </ul>
        </div></details>
        <details><summary>🔧 Manutenção</summary><div className="gb">
          <ul>
            <li>Em <b>Tarefas › Manutenção</b>: coisas de tempos em tempos (filtro do ar, vermífugo, vacina, revisão do carro). Use <b>✦ Modelos prontos</b> para começar.</li>
            <li>Ao marcar <b>✓ Feita</b> (+3 XP), a próxima data é calculada sozinha. Dá para desfazer.</li>
            <li>Aparece em <b>Hoje</b> quando falta pouco (3 dias) ou está atrasada, e no <b>bom dia</b> no dia em que vence.</li>
          </ul>
        </div></details>
        <details><summary>🐾 Cães</summary><div className="gb">
          <ul>
            <li>Cada cão tem suas <b>rotinas</b> (diárias, semanais, quinzenais ou mensais, com horário opcional). Use ✎ no cão para editar nome, raça e fase, e ✎ na rotina para mudar ou remover. “+ Nova rotina” adiciona.</li>
            <li>Em Hoje, a mesma rotina de cães diferentes (ex.: Ração manhã) vira <b>um item só</b>: um toque marca para todos. Elas entram no rodízio e aparecem na lista de quem é a vez; a bolinha com a inicial na aba Cães mostra de quem é.</li>
            <li><b>Modo filhote:</b> registre acidentes por cômodo e acompanhe o dia.</li>
            <li>Tarefas da categoria Cães repetem as rotinas e por isso não aparecem em Hoje; dá para arquivá-las pelo aviso em Tarefas.</li>
          </ul>
        </div></details>
        <details><summary>📲 App e notificações</summary><div className="gb">
          <ul>
            <li><b>Instalar:</b> no Android, “Instalar” em Ajustes (ou menu ⋮ → Instalar app). No iPhone, Safari → Compartilhar → Adicionar à Tela de Início. O Ninho vira um ícone e abre como app.</li>
            <li><b>Sem internet:</b> o app abre com os últimos dados que carregou neste aparelho. Marcar e editar voltam quando a conexão voltar.</li>
            <li><b>☀️ Bom dia</b> (por volta das 7h): o que é seu hoje — fixo ou pela vez do rodízio — e o que vale ⚡ no horário.</li>
            <li><b>🏆 Resumo de domingo</b> (por volta das 19h): placar, quem paga a aposta, sequência e o que ficou para trás.</li>
            <li>Cada aparelho ativa as próprias notificações em Ajustes, e elas seguem “Este aparelho”. No iPhone, só com o app instalado (iOS 16.4+).</li>
          </ul>
        </div></details>
        <details><summary>💬 Telegram e ✦ IA</summary><div className="gb">
          <ul>
            <li><b>Telegram:</b> em Ajustes › Telegram: <b>Conectar</b> liga o seu; <b>Gerar convite</b> cria um link para mandar à outra pelo WhatsApp. O bom dia e o resumo de domingo chegam lá também.</li>
            <li><b>Menu fixo</b> no Telegram: 📋 Hoje, 🛒 Compras, ➕ Adicionar à lista, ✦ Dicas e ❓ Ajuda. Ao tocar no ✓ de uma tarefa, o botão some na hora e o resultado aparece no topo da lista.</li>
            <li>Comandos: <b>/hoje</b> (o que é seu, com botões ✓ para concluir), <b>/feito louça</b>, <b>/compras</b> (ver a lista), <b>/compras leite, 2 kg arroz</b> ou <b>+leite</b> (adicionar), <b>/dicas</b> e <b>/sair</b>.</li>
            <li><b>✦ IA:</b> na Reunião semanal (e no /dicas), a IA lê a semana (placar, quem fez o quê, puladas, o que pesou na reunião passada) e sugere de 3 a 5 ajustes. São sugestões, não regras. Limite de 6 pedidos por dia. O resumo da semana é enviado à Anthropic para gerar as sugestões.</li>
          </ul>
        </div></details>
        <details><summary>🌤 Energia e modo sobrevivência</summary><div className="gb">
          <p>Escolham a <b>energia da semana</b> (alta, média ou baixa). Em energia baixa ou no <b>🛡 modo sobrevivência</b>, Hoje mostra só as essenciais e as rotinas dos cães, com o botão “Mostrar todas”. Vale para a semana atual.</p>
        </div></details>
        <details><summary>📋 Reunião semanal</summary><div className="gb">
          <p>15 minutos, sem cobranças: o que funcionou, o que pesou, ajuste, prioridades, como cada uma chega, vitórias, modo da próxima semana e recompensa. Fica no histórico em Semana.</p>
        </div></details>
        <details><summary>🏆 XP, níveis e sequência</summary><div className="gb">
          <ul>
            <li>Cada tarefa vale pelo esforço: <span className="xp xp-l">+1</span> leve, <span className="xp xp-m">+2</span> médio, <span className="xp xp-h">+3</span> pesado. Rotina de cão vale +1 por cão. O nível é do casal.</li>
            <li><b>⚡ Bônus no horário:</b> diária com horário feita até o horário vale ×1,5 (leve 2, média 3, pesada 5). Feita atrasada no mesmo dia vale o normal: ninguém perde pontos. O ⚡ aparece no XP enquanto ainda dá tempo.</li>
            <li><b>🏆 Placar da semana:</b> o XP de cada uma de segunda a domingo, com a aposta simbólica (troque em Semana). Conta pelo aparelho identificado de quem concluiu.</li>
            <li><b>🔥 Sequências:</b> casa ativa (algo feito no dia), casa em dia (todas as essenciais diárias feitas) e a de cada uma, com recordes. A de hoje só entra depois do primeiro check; ninguém perde a sequência no meio do dia.</li>
            <li><b>🏅 Conquistas:</b> bronze, prata e ouro por cômodo, cães, pontualidade, madrugada, tarefas pesadas, faxina relâmpago (várias tarefas em 1 hora) e recorde de sequência.</li>
            <li>Níveis: {LEVELS.map(l=>`${l.n} (${l.min})`).join(' · ')}.</li>
          </ul>
        </div></details>
        <details><summary>🔣 Símbolos</summary><div className="gb">
          <ul>
            <li><span className="tag-e">● essencial</span> — não pode falhar; caixinha laranja; aparece mesmo no modo sobrevivência.</li>
            <li><span className="tag-t">⏰ 08:00</span> horário · <span className="tag-t late">⏰ 07:00</span> atrasada.</li>
            <li><span className="tag-r">↻</span> rodízio · <span className="tag-next">▸ próxima</span> próxima com horário.</li>
            <li>Bolinha <span style={{color:'var(--green)'}}>●</span> leve, <span style={{color:'var(--amb)'}}>●</span> média, <span style={{color:'var(--cor)'}}>●</span> pesada (na lista de Tarefas).</li>
          </ul>
          <p>Tudo sincroniza na hora entre os celulares de vocês.</p>
        </div></details>
      </div>
    </div>
  )
}
