'use client'
// Avisos (toasts), janelas (modais), "salvando" e itens com gravação em andamento.
// Parte da base do app (components/app/useAppCore.tsx junta as partes na ordem).
import { useState, useRef } from 'react'
import { type NinhoError } from '@/lib/errors'
import { createPendingGuard } from '@/lib/pending'
import type { AppBase, ToastState } from './tipos'

export function useAvisos(_base:AppBase){
  const [modal,setModal]=useState<string|null>(null)
  const [modalData,setModalData]=useState<any>(null)
  const [saving,setSaving]=useState(false)
  const [toast,setToast]=useState<ToastState|null>(null)
  // Itens com gravação em andamento (bloqueia clique duplo; o banco também é idempotente)
  const [pending,setPending]=useState<Set<string>>(new Set())
  const guard=useRef(createPendingGuard(setPending)).current
  const toastTimer=useRef<any>(null)
  const toastRef=useRef<ToastState|null>(null)
  // ── TOASTS ────────────────────────────────────────────
  toastRef.current=toast
  function showToast(msg:string,undo?:()=>void){setToast({kind:'ok',msg,undo});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),undo?4500:2600)}
  function showError(e:NinhoError,retry?:()=>void){
    const r=e.retryable?retry:undefined
    setToast({kind:'err',msg:e.userMessage,retry:r})
    clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),r?8000:6000)
  }
  function closeModal(){setModal(null);setModalData(null)}
  function openModal(m:string,d?:any){setModal(m);setModalData(d??null)}
  async function withPending(keys:string[],fn:()=>Promise<void>){await guard.run(keys,fn)}
  const isPending=(k:string)=>pending.has(k)

  return {
    closeModal,guard,isPending,modal,modalData,openModal,pending,saving,setModal,setModalData,setPending,setSaving,
    setToast,showError,showToast,toast,toastRef,toastTimer,withPending,
  }
}

export type Avisos = ReturnType<typeof useAvisos>
