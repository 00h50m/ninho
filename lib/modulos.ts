// Módulos de cada casa (migration 046): pets (a casa escolhe), IA e Sobrou (só quem administra liga).
// Puro, testado.
export type Feature = 'pets' | 'ia' | 'sobrou'
/** pets: null = a casa ainda não respondeu (configuração inicial). */
export interface Features { pets: boolean | null, ia: boolean, sobrou: boolean, /** casa de 1 pessoa (047) */ solo: boolean }

/** Antes da migration 046 (sem a coluna): tudo como sempre foi (uma casa só, com tudo ligado). */
export const LEGACY: Features = { pets: null, ia: true, sobrou: true, solo: false }

export function featuresOf(raw: unknown): Features {
  if (!raw || typeof raw !== 'object') return { pets: null, ia: false, sobrou: false, solo: false }
  const r = raw as Record<string, unknown>
  return { pets: typeof r.pets === 'boolean' ? r.pets : null, ia: r.ia === true, sobrou: r.sobrou === true, solo: r.solo === true }
}

/** Mostrar a aba Cães e as rotinas dos pets? Sem resposta ainda, só se já há cão cadastrado. */
export const showPets = (f: Features, hasDogs: boolean) => f.pets === true || (f.pets === null && hasDogs)

export const OFF_MSG: Record<'ia' | 'sobrou', string> = {
  ia: 'A IA não está ligada para esta casa.',
  sobrou: 'O Sobrou não está ligado para esta casa.',
}

/** As pessoas da casa: na casa de 1 pessoa (047), só a primeira. */
export const peopleOf = (solo: boolean): Array<'g' | 's'> => solo ? ['g'] : ['g', 's']
