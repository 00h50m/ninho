// Meta de proteína do dia e o que encaixar para chegar nela (com os alimentos da pessoa).
// Puro, testado. É estimativa: o plano da nutricionista vale mais.
import { norm, type CustomFood, type FoodProfile } from './nutricao'

/** g por kg sugeridos pelo objetivo, quando a pessoa não escolheu (referências usuais). */
export const PROTEIN_DEFAULT: Record<FoodProfile['goal'], number> = { perder: 1.6, manter: 1.2, ganhar: 1.6 }

export interface ProteinTarget { g: number, perKg: number, baseKg: number, manual: boolean }

/**
 * Meta em gramas. Para emagrecer com peso-alvo, a conta usa o peso-alvo (o peso atual superestima).
 * protein_g_kg (033) vem do perfil; vazio = sugestão pelo objetivo.
 */
export function proteinTarget(pr: Pick<FoodProfile, 'goal' | 'target_kg'> & { protein_g_kg?: number | null }, weightKg: number): ProteinTarget {
  const manual = pr.protein_g_kg != null && pr.protein_g_kg > 0
  const perKg = manual ? Number(pr.protein_g_kg) : PROTEIN_DEFAULT[pr.goal]
  const baseKg = pr.goal === 'perder' && pr.target_kg && pr.target_kg < weightKg ? pr.target_kg : weightKg
  return { g: Math.round(perKg * baseKg), perKg, baseKg, manual }
}

const base = (name: string) => norm(name).replace(/\s*\d+([.,]\d+)?\s*(g|ml|kg)\b.*$/, '').trim()

export interface ProteinIdea { food: CustomFood, portions: number, protein: number, kcal: number }

/**
 * Até 3 ideias para completar a proteína que falta: os alimentos com mais proteína por caloria,
 * em porções inteiras (1 a 3), sem passar das calorias que restam (com folga de 100 kcal).
 */
export function proteinIdeas(leftG: number, kcalLeft: number, foods: CustomFood[]): ProteinIdea[] {
  if (leftG < 5) return []
  const room = Math.max(0, kcalLeft) + 100
  return foods
    .filter(f => (f.protein ?? 0) >= 3 && f.kcal > 0 && (f.protein ?? 0) * 4 <= f.kcal * 1.15 + 5)
    .map(f => ({ f, ratio: (f.protein as number) / f.kcal }))
    .sort((a, b) => b.ratio - a.ratio || a.f.name.localeCompare(b.f.name, 'pt-BR'))
    // "Whey - 20 g", "Whey - 30 g"…: uma ideia por alimento
    .filter((x, i, all) => all.findIndex(y => base(y.f.name) === base(x.f.name)) === i)
    .flatMap(({ f }): ProteinIdea[] => {
      const p = f.protein as number
      const portions = Math.max(1, Math.min(3, Math.round(leftG / p)))
      const fit = [portions, portions - 1, portions - 2].filter(n => n >= 1).find(n => n * f.kcal <= room)
      return fit ? [{ food: f, portions: fit, protein: Math.round(fit * p * 10) / 10, kcal: Math.round(fit * f.kcal) }] : []
    })
    .slice(0, 3)
}
