'use client'
// Preferências deste aparelho: tema, conforto (tamanho, contraste, movimento), cartões e filtros do Início e das tarefas.
// Parte da base do app (components/app/useAppCore.tsx junta as partes na ordem).
import { useEffect, useState } from 'react'
import type { Who } from '@/lib/types'
import { applyTheme, readTheme, saveTheme, type ThemeId } from '@/lib/theme'
import { DEFAULT_A11Y, applyA11y, effectiveTheme, readA11y, saveA11y, type A11yPrefs } from '@/lib/a11y'
import type { AppBase } from './tipos'
import type { Avisos } from './useAvisos'

export function usePreferencias(_c:AppBase&Avisos){
  const [theme,setThemeState]=useState<ThemeId>('aconchego')
  // Conforto do aparelho (Fase 9): tamanho, contraste, movimento, tema automático, cartões do Início
  const [a11y,setA11yState]=useState<A11yPrefs>(DEFAULT_A11Y)
  const [darkNow,setDarkNow]=useState(false)
  useEffect(()=>{
    const mq=typeof matchMedia!=='undefined'?matchMedia('(prefers-color-scheme: dark)'):null
    setThemeState(readTheme(null,!!mq?.matches));setA11yState(readA11y());setDarkNow(!!mq?.matches)
    const on=(e:MediaQueryListEvent)=>setDarkNow(e.matches)
    mq?.addEventListener?.('change',on)
    return()=>mq?.removeEventListener?.('change',on)
  },[])
  const shownTheme=effectiveTheme(a11y,theme,darkNow)
  useEffect(()=>{applyTheme(shownTheme)},[shownTheme])
  useEffect(()=>{applyA11y(a11y)},[a11y])
  const setA11y=(patch:Partial<A11yPrefs>)=>setA11yState(p=>{const n={...p,...patch};saveA11y(n);return n})
  const showCard=(k:string)=>!a11y.hidden.includes(k)
  function pickTheme(t:ThemeId){saveTheme(t);setThemeState(t);if(a11y.autoTheme)setA11y({autoTheme:false})}
  const [taskFilter,setTaskFilter]=useState('all')
  const [query,setQuery]=useState('')
  const [person,setPerson]=useState<Who>('g')
  const [showDone,setShowDone]=useState<Record<Who,boolean>>({g:false,s:false})
  /** Início: lista por grupos ou linha do tempo do dia (lembrado neste aparelho) */
  const [homeView,setHomeView]=useState<'lista'|'tempo'>('lista')
  useEffect(()=>{try{if(localStorage.getItem('ninho.homeView')==='tempo')setHomeView('tempo')}catch{}},[])
  const pickHomeView=(v:'lista'|'tempo')=>{setHomeView(v);try{localStorage.setItem('ninho.homeView',v)}catch{}}
  const [showAllToday,setShowAllToday]=useState(false)
  // Preferências locais: aba e coluna visualizada no celular.
  // A coluna visualizada NÃO muda quem está usando o aparelho.
  useEffect(()=>{
    // O app sempre abre em Hoje (a aba anterior não é mais restaurada)
    try{localStorage.removeItem('ninho.tab')}catch{}
  },[])

  return {
    a11y,darkNow,homeView,person,pickHomeView,pickTheme,query,setA11y,setA11yState,setDarkNow,setHomeView,setPerson,
    setQuery,setShowAllToday,setShowDone,setTaskFilter,setThemeState,showAllToday,showCard,showDone,shownTheme,
    taskFilter,theme,
  }
}

export type Preferencias = ReturnType<typeof usePreferencias>
