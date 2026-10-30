'use client'
// Base do app, dividida em partes. Cada parte recebe o que as anteriores devolveram; a ordem importa
// (os avisos vêm primeiro porque quase tudo os usa; a fila e as entradas por último porque usam os dados).
import { useAvisos } from './useAvisos'
import { usePreferencias } from './usePreferencias'
import { useNavegacao } from './useNavegacao'
import { useDados } from './useDados'
import { useFilaOffline } from './useFilaOffline'
import { useEntradas } from './useEntradas'
import type { AppBase } from './tipos'

export type { Account, AppBase, ToastState } from './tipos'

export function useAppCore(base:AppBase){
  const comAvisos={...base,...useAvisos(base)}
  const comPreferencias={...comAvisos,...usePreferencias(comAvisos)}
  const comNavegacao={...comPreferencias,...useNavegacao(comPreferencias)}
  const comDados={...comNavegacao,...useDados(comNavegacao)}
  const comFilaOffline={...comDados,...useFilaOffline(comDados)}
  const comEntradas={...comFilaOffline,...useEntradas(comFilaOffline)}
  return comEntradas
}

export type AppCore = ReturnType<typeof useAppCore>
