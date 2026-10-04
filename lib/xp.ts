import type { TaskWeight } from '@/types/ninho'

export const XP_BY_WEIGHT: Record<TaskWeight, number> = {
  light: 1,
  medium: 2,
  heavy: 3,
}

export const LEVELS = [
  { l: 1, n: 'Nest Builders', min: 0, max: 100 },
  { l: 2, n: 'Nest Keepers', min: 100, max: 300 },
  { l: 3, n: 'Home Runners', min: 300, max: 600 },
  { l: 4, n: 'Domestic Legends', min: 600, max: 1000 },
  { l: 5, n: 'Ninho Masters', min: 1000, max: 9999 },
] as const

export function getLevel(xp: number) {
  return [...LEVELS].reverse().find((level) => xp >= level.min) || LEVELS[0]
}

