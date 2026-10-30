// Tipos comuns às partes do estado do app.
import type { Who } from '@/lib/types'

export type ToastState={kind:'ok'|'err',msg:string,undo?:()=>void,retry?:()=>void}
export interface Account { who:Who, email:string, onSignOut:()=>void }
/** O que o app recebe de fora: a casa e a conta de quem entrou. */
export type AppBase={householdId:string,account?:Account}
