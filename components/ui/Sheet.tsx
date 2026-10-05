'use client'
import { useEffect, useRef, ReactNode } from 'react'

// Modal: centralizado no desktop, folha que sobe de baixo no celular. Fecha com Esc,
// exceto quando dismissable=false (escolha obrigatória).
export function Sheet({title,onClose,children,footer,size,dismissable=true}:{title:ReactNode,onClose:()=>void,children:ReactNode,footer?:ReactNode,size?:'sm'|'lg',dismissable?:boolean}){
  const closeRef=useRef(onClose)
  closeRef.current=dismissable?onClose:()=>{}
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==='Escape')closeRef.current()}
    window.addEventListener('keydown',h)
    const prev=document.body.style.overflow;document.body.style.overflow='hidden'
    return()=>{window.removeEventListener('keydown',h);document.body.style.overflow=prev}
  },[])
  return(
    <div className="mwrap" onClick={()=>closeRef.current()}>
      <div className={`modal ${size?'modal-'+size:''}`} role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div className="mh"><span className="mht">{title}</span>{dismissable&&<button className="mclose" onClick={onClose} aria-label="Fechar">✕</button>}</div>
        <div className="mbody">{children}</div>
        {footer&&<div className="mfoot">{footer}</div>}
      </div>
    </div>
  )
}
