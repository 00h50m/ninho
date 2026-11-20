'use client'
// Módulos da casa (pets, IA, Sobrou) e o contexto para as telas lerem sem passar de mão em mão.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { LEGACY, showPets, type Features } from '@/lib/modulos'
import * as api from '@/lib/services/modulos'

export function useModulosLoader(householdId: string) {
  const [features, setFeatures] = useState<Features>(LEGACY)
  const [ready, setReady] = useState(false)
  const reload = useCallback(async () => { setFeatures(await api.loadFeatures(householdId)); setReady(true) }, [householdId])
  useEffect(() => { reload().catch(() => setReady(true)) }, [reload])
  const setPets = useCallback(async (on: boolean) => { setFeatures(await api.setPets(householdId, on)) }, [householdId])
  return { features, ready, reload, setPets }
}

export interface Modulos { ai: boolean, sobrou: boolean, pets: boolean, features: Features }
export const ModulosContext = createContext<Modulos>({ ai: true, sobrou: true, pets: true, features: LEGACY })
export const useModulos = () => useContext(ModulosContext)
export const modulosOf = (f: Features, hasDogs: boolean): Modulos => ({ ai: f.ia, sobrou: f.sobrou, pets: showPets(f, hasDogs), features: f })
