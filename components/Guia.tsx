'use client'
// Guia do Ninho (Ajustes › Ajuda) e o aviso "O que mudou" (Início, uma vez por aparelho).
import { useEffect, useState, type ReactNode } from 'react'
import type { Names } from '@/lib/types'
import { LEVELS } from '@/lib/xp'

const first = (n: string) => (n || '').split(' ')[0]

/** Muda quando há novidades para contar; cada aparelho vê uma vez. */
export const NEWS_VERSION = '2026-11b'
const NEWS_KEY = 'ninho.novidades'
const NEWS: ReactNode[] = [
  <><b>Deslize na tarefa</b> (celular): para a direita conclui, para a esquerda abre as opções.</>,
  <><b>Puxe a tela para baixo</b> no topo para atualizar tudo.</>,
  <><b>🕰 Tarefas sem horário</b> agora lembram na hora em que você costuma fazer (o Ninho aprende sozinho). Dá para desligar em Ajustes › Notificações.</>,
  <>Fechou tudo o que era seu no dia? Tem <b>comemoração</b> 🎉</>,
  <><b>⤼ Não deu</b>: a tarefa ou a rotina dos cães atrasada sai da lista de hoje com um toque, sem XP.</>,
]

export function NewsCard({ onGuide }: { onGuide: () => void }) {
  const [show, setShow] = useState(false)
  useEffect(() => { try { setShow(localStorage.getItem(NEWS_KEY) !== NEWS_VERSION) } catch { /* sem armazenamento: não mostra */ } }, [])
  if (!show) return null
  const close = () => { setShow(false); try { localStorage.setItem(NEWS_KEY, NEWS_VERSION) } catch { /* ok */ } }
  return (
    <section className="card news" id="novidades" aria-labelledby="news-h">
      <div className="slbl" id="news-h">✨ O que mudou no Ninho</div>
      <ul className="news-l">{NEWS.map((n, i) => <li key={i}>{n}</li>)}</ul>
      <div className="news-f">
        <button className="btn btn-p btn-s" onClick={close}>Entendi</button>
        <button className="lnk-inline" onClick={() => { close(); onGuide() }}>Ver o guia completo</button>
      </div>
    </section>
  )
}

export function GuideContent({ names }: { names: Names }) {
  const g = first(names.g), s = first(names.s)
  return <>
    <details open><summary>🧭 Onde fica cada coisa</summary><div className="gb">
      <ul>
        <li><b>☀️ Início:</b> o dia de hoje: o que é de cada uma, cães, agenda, jantar e compras.</li>
        <li><b>🌿 Meu dia:</b> só seu: água, hábitos, comida, treinos, corpo e as suas metas.</li>
        <li><b>🏡 Casa:</b> Tarefas (e Rotinas) · Compras (Lista, Despensa e Jantar) · Agenda · Mais (Manutenção, Faxinão e Sugestões).</li>
        <li><b>🐾 Cães:</b> rotinas, escala, saúde, ração e filhote.</li>
        <li><b>💛 Nós:</b> Semana (Resumo e Equilíbrio) · Juntas (Desafios, Álbum e Presentes) · Histórico.</li>
        <li><b>⚙️ Ajustes</b> (na sua inicial, no topo): aparência, cartões do Início, notificações, Telegram, conta e ajustes da casa.</li>
        <li><b>+</b> (botão redondo): os 4 atalhos mais usados no topo e o resto em seções. <b>🔍</b> busca tarefas, compras, agenda e também abre funções.</li>
      </ul>
    </div></details>
    <details><summary>☀️ Início</summary><div className="gb">
      <ul>
        <li><b>Para agora</b> mostra o que está atrasado, as essenciais e a próxima com horário. Logo abaixo, a coluna de cada uma (no celular, troque pelo seletor).</li>
        <li>No celular, <b>deslize</b> a tarefa para a direita para concluir ou para a esquerda para as opções. No topo da tela, <b>puxe para baixo</b> para atualizar.</li>
        <li>Toque na tarefa para concluir (+XP, com Desfazer). As concluídas ficam no fim da coluna com <b>quem concluiu</b>: quem marca fica registrada, mesmo que a tarefa fosse da outra.</li>
        <li>No <b>⋯</b> da tarefa: Não deu hoje (pular), deixar para amanhã, passar só hoje, passar de vez, pausar e pedir ajuda.</li>
        <li>Os cartões do Início podem ser escondidos em <b>Ajustes › Início</b>.</li>
      </ul>
    </div></details>
    <details><summary>✓ Tarefas e rotinas</summary><div className="gb">
      <ul>
        <li><b>Frequência:</b> diária, semanal, quinzenal, mensal ou pontual. Dá para escolher <b>dias da semana</b>, um <b>período</b> (De… até…) e <b>pausar</b> por um tempo.</li>
        <li><b>⤼ Não deu:</b> tarefa diária ou rotina dos cães atrasada ganha o botão ao lado do check. Sai da lista de hoje <b>sem XP e sem quebrar a sequência</b>. Fica em “Não deu ou para amanhã”, com ↺ Voltar.</li>
        <li><b>Rotinas com passos</b> (Casa › Tarefas › Rotinas): checklist num horário, como “fechar a cozinha”, que pode ser das duas, de uma ou em rodízio.</li>
        <li><b>💡 Sugestões</b> (Casa › Mais): tarefas prontas por cômodo e checklists de estação.</li>
      </ul>
    </div></details>
    <details><summary>↻ Divisão das tarefas</summary><div className="gb">
      <p>Tarefas sem responsável fixa (↻) são divididas entre vocês. O jeito fica em <b>Nós › Semana › Equilíbrio</b> (ou Ajustes › Casa):</p>
      <ul>
        <li><b>✦ Inteligente</b> (padrão): quem fez por último passa a vez, e quem está com mais carga na semana recebe menos.</li>
        <li><b>↻ Rodízio fixo:</b> alterna sempre na mesma ordem.</li>
      </ul>
      <p>No <b>⋯</b> da tarefa aparece <b>por que é a vez de quem</b>. ⇄ numa tarefa de rodízio fixa ela com a outra (dá para desfazer).</p>
    </div></details>
    <details><summary>🛒 Compras, despensa e jantar</summary><div className="gb">
      <ul>
        <li>Lista <b>ao vivo</b> entre os celulares, na ordem dos corredores, com mercado e preço. <b>Finalizar compra</b> tira os riscados e oferece marcar a tarefa de mercado.</li>
        <li><b>Despensa:</b> o que vence logo aparece no Início. <b>Jantar:</b> quem cozinha e ideias com o que tem em casa.</li>
      </ul>
    </div></details>
    <details><summary>📅 Agenda, manutenção e 🧹 Faxinão</summary><div className="gb">
      <ul>
        <li><b>Agenda:</b> compromissos, visitas, entregas e vencimentos. O que bate com o horário de uma tarefa avisa no Início.</li>
        <li><b>Manutenção:</b> coisas de tempos em tempos (filtro, vacina, revisão). Ao marcar ✓, a próxima data é calculada sozinha.</li>
        <li><b>Faxinão:</b> diga tudo o que precisa e a IA põe na ordem que rende mais e divide entre vocês (ou fica tudo com uma: “Só eu”). Ao vivo, cada uma vê o que é dela agora.</li>
      </ul>
    </div></details>
    <details><summary>🐾 Cães</summary><div className="gb">
      <ul>
        <li>A mesma rotina de cães diferentes (ex.: Ração manhã) vira <b>um item só</b> no Início: um toque marca para todos.</li>
        <li><b>Escala:</b> quem cuida em cada período, ou rodízio. Saúde (vacinas, vermífugo), ração (avisa antes de acabar) e modo filhote.</li>
      </ul>
    </div></details>
    <details><summary>🌿 Meu dia</summary><div className="gb">
      <p>Só seu: água, sono, remédios, hábitos, comida (plano, cardápio e foto do prato), treinos e corpo. Em <b>Meu dia › Ajustes</b> você escolhe as metas e o que a outra vê.</p>
    </div></details>
    <details><summary>💛 Nós</summary><div className="gb">
      <ul>
        <li><b>Reunião semanal:</b> 15 minutos, sem cobranças. A pauta traz a semana e o que ficou para trás, com ajuste de um toque.</li>
        <li><b>Juntas:</b> desafios em dupla, álbum e presentes. <b>Histórico:</b> retrospectiva com gráficos, linha do tempo, sequências e conquistas.</li>
      </ul>
    </div></details>
    <details><summary>🌤 Como está a semana</summary><div className="gb">
      <p>O chip no topo do Início abre a <b>energia da semana</b> (alta, média ou baixa) e a chave do <b>🛡 modo sobrevivência</b>. Em energia baixa ou no modo sobrevivência, o Início mostra só as essenciais e as rotinas dos cães, com “Mostrar todas”.</p>
    </div></details>
    <details><summary>🔔 Notificações e 💬 Telegram</summary><div className="gb">
      <ul>
        <li>Cada aparelho liga as próprias notificações em <b>Ajustes › Notificações</b>, com horário de silêncio. No iPhone, só com o app instalado na tela de início.</li>
        <li><b>🕰 Tarefas sem horário:</b> depois de 3 vezes feitas num horário parecido (últimas 4 semanas), o Ninho lembra nesse horário, só para quem é a vez e se ainda não foi feita.</li>
        <li><b>Telegram</b> (Ajustes › Telegram): bom dia, resumo da noite, resumo de domingo e lembretes. No lembrete de tarefa dá para tocar em <b>✓ Feito</b> ou <b>⤼ Não deu</b> ali mesmo.</li>
        <li>No Telegram: <b>/hoje</b>, <b>/semana</b>, <b>/compras</b>, “comprei leite”, “faxinão: …” (ou “faxinão só eu: …”), perguntas (“como tiro mancha de…?”) e áudio.</li>
      </ul>
    </div></details>
    <details><summary>🏆 XP, níveis e sequência</summary><div className="gb">
      <ul>
        <li>Cada tarefa vale pelo esforço: <span className="xp xp-l">+1</span> leve, <span className="xp xp-m">+2</span> médio, <span className="xp xp-h">+3</span> pesado. Diária com horário feita até o horário vale ×1,5 (⚡).</li>
        <li><b>🔥 Sequências:</b> casa ativa, casa em dia (todas as essenciais diárias feitas) e a de cada uma. Pular (Não deu) não quebra a sequência.</li>
        <li>Níveis: {LEVELS.map(l => `${l.n} (${l.min})`).join(' · ')}.</li>
      </ul>
    </div></details>
    <details><summary>🔣 Símbolos</summary><div className="gb">
      <ul>
        <li><span className="tag-e">● essencial</span>: não pode falhar e aparece mesmo no modo sobrevivência.</li>
        <li><span className="tag-t">⏰ 08:00</span> horário · <span className="tag-t late">⏰ 07:00</span> atrasada · <span className="tag-r">↻</span> rodízio · <span className="tag-next">▸ próxima</span>.</li>
        <li>As cores de cada uma: {g} e {s} têm sempre a mesma cor em todo o app.</li>
      </ul>
      <p>Tudo sincroniza na hora entre os celulares de vocês.</p>
    </div></details>
  </>
}
