'use client'
// Estado e ações do app, divididos por assunto em components/app/*. Cada parte recebe o que as
// anteriores devolveram; a ordem importa (o dia vem antes das tarefas; Nós antes de Casa).
// As telas recebem o retorno inteiro como `a` (tipo App).
import { useAppCore } from './useAppCore'
import { useDia } from './useDia'
import { useTarefas } from './useTarefas'
import { useRotinasSprint } from './useRotinasSprint'
import { useCaesAcoes } from './useCaesAcoes'
import { useNosAcoes } from './useNosAcoes'
import { useCasaAcoes } from './useCasaAcoes'
import { useTelas } from './useTelas'
import type { Account } from './useAppCore'

export type { Account, ToastState } from './useAppCore'

export function useNinhoApp(props:{householdId:string,account?:Account}){
  // cada passo junta o que a parte nova devolve ao que já existia
  const core=useAppCore(props)
  const comDia={...core,...useDia(core)}
  const comTarefas={...comDia,...useTarefas(comDia)}
  const comRotinas={...comTarefas,...useRotinasSprint(comTarefas)}
  const comCaes={...comRotinas,...useCaesAcoes(comRotinas)}
  const comNos={...comCaes,...useNosAcoes(comCaes)}
  const comCasa={...comNos,...useCasaAcoes(comNos)}
  return {...comCasa,...useTelas(comCasa)}
}

export type App = ReturnType<typeof useNinhoApp>
