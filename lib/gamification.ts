// Gamificação: bônus de pontualidade, placar semanal, sequências e conquistas.
// O XP oficial é decidido no banco (migration 005); aqui ficam as mesmas regras
// para a prévia na tela e a avaliação das conquistas a partir das estatísticas.
import type { Who } from './types'
import { hhmm } from './dates'

/** Diária com horário concluída até o horário vale ×1,5 (para cima). Atrasada no mesmo dia: XP normal. */
export const ON_TIME_MULTIPLIER = 1.5

export function xpWithBonus(base: number, onTime: boolean): number {
  return onTime ? Math.ceil(base * ON_TIME_MULTIPLIER) : base
}

/** Ainda dá tempo de ganhar o bônus (mesma regra de ninho_is_on_time). */
export function canEarnOnTime(x: { frequency: string, scheduled_time: string | null, completed_today?: boolean }, nowHM: string): boolean {
  return x.frequency === 'daily' && !!x.scheduled_time && !x.completed_today && nowHM <= hhmm(x.scheduled_time)
}

// ── Placar ──────────────────────────────────────────────────────────────
export interface PersonScore { xp: number, done: number, on_time: number }
export interface WeeklyScores { g: PersonScore, s: PersonScore, unknown: PersonScore }
export const EMPTY_SCORE: PersonScore = { xp: 0, done: 0, on_time: 0 }
export const EMPTY_SCORES: WeeklyScores = { g: EMPTY_SCORE, s: EMPTY_SCORE, unknown: EMPTY_SCORE }

/** Quem lidera (ou empate). */
export function leaderOf(s: WeeklyScores): Who | 'tie' {
  if (s.g.xp === s.s.xp) return 'tie'
  return s.g.xp > s.s.xp ? 'g' : 's'
}

export const DEFAULT_BET = 'Quem perder escolhe o jantar'

// ── Sequências ──────────────────────────────────────────────────────────
export interface Streaks { house: number, house_best: number, on_track: number, on_track_best: number, g: number, g_best: number, s: number, s_best: number }
export const EMPTY_STREAKS: Streaks = { house: 0, house_best: 0, on_track: 0, on_track_best: 0, g: 0, g_best: 0, s: 0, s_best: 0 }

// ── Conquistas ──────────────────────────────────────────────────────────
export interface PersonStats { categories: Record<string, number>, heavy: number, on_time: number, early: number, flash: number, best_streak: number }
export type AchievementStats = Partial<Record<Who, PersonStats>>

export const TIER_NAMES = ['Bronze', 'Prata', 'Ouro'] as const

export interface AchievementDef {
  id: string
  icon: string
  name: string
  /** O que conta, no singular de quem lê ("tarefas de lavanderia") */
  unit: string
  tiers: number[]
  value: (s: PersonStats) => number
}

const cat = (k: string) => (s: PersonStats) => s.categories?.[k] || 0

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'laundry', icon: '👕', name: 'Mestre da Lavanderia', unit: 'tarefas de lavanderia', tiers: [10, 50, 150], value: cat('laundry') },
  { id: 'kitchen', icon: '🍳', name: 'Chef da Limpeza', unit: 'tarefas de cozinha', tiers: [10, 50, 150], value: cat('kitchen') },
  { id: 'bathroom', icon: '🚿', name: 'Banheiro Brilhando', unit: 'tarefas de banheiro', tiers: [10, 50, 150], value: cat('bathroom') },
  { id: 'bedroom', icon: '🛏', name: 'Guardiã do Quarto', unit: 'tarefas de quarto', tiers: [10, 50, 150], value: cat('bedroom') },
  { id: 'general', icon: '🏠', name: 'Casa em Ordem', unit: 'tarefas gerais', tiers: [10, 50, 150], value: cat('general') },
  { id: 'dogs', icon: '🐾', name: 'Melhor Amiga dos Cães', unit: 'cuidados com os cães', tiers: [20, 100, 300], value: cat('dogs') },
  { id: 'shopping', icon: '🛒', name: 'Rainha das Compras', unit: 'tarefas de compras', tiers: [5, 25, 75], value: cat('shopping') },
  { id: 'finance', icon: '💰', name: 'Finanças em Dia', unit: 'tarefas de finanças', tiers: [5, 25, 75], value: cat('finance') },
  { id: 'flash', icon: '⚡', name: 'Faxina Relâmpago', unit: 'tarefas em 1 hora', tiers: [5, 8, 12], value: s => s.flash || 0 },
  { id: 'on_time', icon: '⏰', name: 'Pontualidade', unit: 'tarefas no horário', tiers: [10, 50, 150], value: s => s.on_time || 0 },
  { id: 'early', icon: '🌅', name: 'Madrugadora', unit: 'conclusões antes das 8h', tiers: [10, 30, 100], value: s => s.early || 0 },
  { id: 'heavy', icon: '🏋', name: 'Peso Pesado', unit: 'tarefas pesadas', tiers: [5, 25, 75], value: s => s.heavy || 0 },
  { id: 'streak', icon: '🔥', name: 'Sequência de Ferro', unit: 'dias seguidos (recorde)', tiers: [7, 30, 100], value: s => s.best_streak || 0 },
]

export interface AchievementState {
  def: AchievementDef
  value: number
  /** 0 = nenhuma, 1 = bronze, 2 = prata, 3 = ouro */
  tier: number
  /** próxima meta (ou a última, se já está no ouro) */
  next: number
  /** 0–100 até a próxima meta */
  progress: number
}

export function evaluate(stats: PersonStats | undefined): AchievementState[] {
  return ACHIEVEMENTS.map(def => {
    const value = stats ? def.value(stats) : 0
    const tier = def.tiers.filter(t => value >= t).length
    const next = def.tiers[Math.min(tier, def.tiers.length - 1)]
    const prev = tier === 0 ? 0 : def.tiers[tier - 1]
    const progress = tier >= def.tiers.length ? 100 : Math.max(0, Math.min(100, Math.round(((value - prev) / (next - prev)) * 100)))
    return { def, value, tier, next, progress }
  })
}

/** Conquistas que subiram de nível entre duas avaliações (para avisar "nova conquista"). */
export function newlyUnlocked(before: AchievementState[], after: AchievementState[]): AchievementState[] {
  const prev = new Map(before.map(a => [a.def.id, a.tier]))
  return after.filter(a => a.tier > (prev.get(a.def.id) ?? 0))
}
