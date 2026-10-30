'use client'
// Navegação: tela e abas atuais, ir para uma tela, voltar do celular, janelas do topo (busca, organizar o dia, perguntar) e o botão + flutuante.
// Parte da base do app (components/app/useAppCore.tsx junta as partes na ordem).
import { useEffect, useState, useRef } from 'react'
import { legacyScreen, type CasaView, type ScreenId } from '@/components/shell/Shell'
import { navigateTo, startBackNav } from '@/lib/backNav'
import { type MdFocus } from '@/components/meudia/MeuDia'
import { CASA_GROUP, type CasaGroup, type MdTab } from '@/lib/nav'
import type { AppBase } from './tipos'
import type { Avisos } from './useAvisos'
import type { Preferencias } from './usePreferencias'

export function useNavegacao(c:AppBase&Avisos&Preferencias){
  const {showToast}=c
  const [screen,setScreenState]=useState<ScreenId>('inicio')
  const [casaView,setCasaView]=useState<CasaView>('tarefas')
  const [nosView,setNosView]=useState<'semana'|'desafios'|'historico'|'equilibrio'|'presentes'|'album'>('semana')
  // Casa: a última aba aberta de cada grupo (Comida, Mais)
  const casaLast=useRef<Partial<Record<CasaGroup,CasaView>>>({})
  const [rotView,setRotView]=useState<'rotinas'|'habitos'>('rotinas')
  const [dayOpen,setDayOpen]=useState(false)
  const [askOpen,setAskOpen]=useState(false)
  /** Vai para uma tela. Aceita também as abas antigas (today, tasks, shop, week, pets, settings). */
  function setTab(t:string){const r=legacyScreen(t);setScreenState(r.screen);if(r.casa)setCasaView(r.casa);window.scrollTo({top:0})}
  const go=(sc:ScreenId)=>setTab(sc)
  const goCasa=(v:CasaView)=>{setTab('casa');setCasaView(v)}
  // Links das notificações (?ir=meudia, desafios, sprint…): abre a tela certa e limpa o endereço
  const [wantSprint,setWantSprint]=useState(false)
  const [mdTab,setMdTab]=useState<MdTab>('hoje'),[mdFocus,setMdFocus]=useState<MdFocus>(null)
  /** Pop-up de água: >0 = aberto pelo lembrete (força); o próprio pop-up decide se abre sozinho */
  const [aguaPop,setAguaPop]=useState(0)
  /** Atalho do ícone "+1 copo": registra assim que o Meu dia carregar e mostra o pop-up (dá para desfazer) */
  const [wantCup,setWantCup]=useState(false)
  /** 🔍 Busca em tudo (lupa no topo ou Ctrl/⌘+K) */
  const [busca,setBusca]=useState(false)
  useEffect(()=>{
    const k=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setBusca(true)}}
    window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)
  },[])
  /** Abre uma parte do Meu dia (e, se pedido, rola até um cartão). */
  const goMd=(t:MdTab,what?:NonNullable<MdFocus>['what'])=>{setTab('eu');setMdTab(t);if(what)setMdFocus({what,n:Date.now()})}
  // ── VOLTAR DO CELULAR (lib/backNav) ──
  // Cada tela/aba vira uma entrada no histórico; as janelas (folhas) fecham com o voltar;
  // no Início, o voltar pede "toque de novo para sair" em vez de fechar o app de cara.
  const HOME_NAV={screen:'inicio',casa:'tarefas',nos:'semana',rot:'rotinas',md:'hoje'}
  useEffect(()=>startBackNav({screen,casa:casaView,nos:nosView,rot:rotView,md:mdTab},n=>{
    setScreenState(n.screen as ScreenId);setCasaView(n.casa as CasaView);setNosView(n.nos as any);setRotView(n.rot as any);setMdTab(n.md as MdTab);window.scrollTo({top:0})
  },n=>{
    if(n.screen!=='inicio')return HOME_NAV
    showToast('Toque em voltar de novo para sair do Ninho');return null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }),[])
  useEffect(()=>{navigateTo({screen,casa:casaView,nos:nosView,rot:rotView,md:mdTab})},[screen,casaView,nosView,rotView,mdTab])
  useEffect(()=>{casaLast.current[CASA_GROUP[casaView]]=casaView},[casaView])
  // botão + flutuante: some enquanto rola para baixo (não cobre os botões dos itens) e volta ao subir
  const [fabAway,setFabAway]=useState(false)
  useEffect(()=>{let last=window.scrollY
    const on=()=>{const y=window.scrollY;if(y>last+8&&y>120)setFabAway(true);else if(y<last-8||y<=120)setFabAway(false);last=y}
    window.addEventListener('scroll',on,{passive:true});return()=>window.removeEventListener('scroll',on)},[])

  return {
    HOME_NAV,aguaPop,askOpen,busca,casaLast,casaView,dayOpen,fabAway,go,goCasa,goMd,mdFocus,mdTab,nosView,rotView,
    screen,setAguaPop,setAskOpen,setBusca,setCasaView,setDayOpen,setFabAway,setMdFocus,setMdTab,setNosView,
    setRotView,setScreenState,setTab,setWantCup,setWantSprint,wantCup,wantSprint,
  }
}

export type Navegacao = ReturnType<typeof useNavegacao>
