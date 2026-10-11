// Mascote do Ninho: um passarinho que acompanha o dia da casa. O humor vem do
// estado do dia (sem culpa, sem cobrança) e o visual cresce com o nível do casal.
// Puro (sem rede/banco), testado.

export type Mood = 'sono' | 'festa' | 'calma' | 'preocupado' | 'animado' | 'feliz'
export interface MascotState {
  hour: number, total: number, done: number, late: number, chaos: number, survival: boolean, lowEnergy: boolean
  streak: number, level: number, next: string | null, dogsLate: string[], me: string | null
}
export interface MascotSay { mood: Mood, line: string, stage: number }

export const MASCOT_NAME = 'Nino'
export const STAGES = ['Filhote', 'Com penas', 'De cachecol', 'Florido', 'Coroado']
const MILESTONES = [3, 7, 14, 21, 30, 50, 100]

/** O que o Nino diz agora (a primeira regra que vale). */
export function mascotSay(s: MascotState): MascotSay {
  const stage = Math.max(1, Math.min(5, s.level))
  const left = s.total - s.done
  const hi = s.me ? `, ${s.me}` : ''
  const say = (mood: Mood, line: string): MascotSay => ({ mood, line, stage })
  if (s.total > 0 && left === 0) return say('festa', s.hour >= 18 ? `Tudo feito hoje${hi}! Agora é descanso 🎉` : `Tudo feito${hi}! Que dia 🎉`)
  if (s.hour >= 23 || s.hour < 5) return say('sono', left > 0 ? `Já é tarde. O que faltou pode ficar para amanhã 🌙` : 'Shhh… hora de dormir 🌙')
  if (s.survival) return say('calma', 'Modo sobrevivência: só o essencial. Ir devagar também conta 💛')
  if (MILESTONES.includes(s.streak) && s.done > 0) return say('festa', `🔥 ${s.streak} dias seguidos! Vocês estão voando`)
  if (s.dogsLate.length) return say('preocupado', `${s.dogsLate.join(' e ')} ${s.dogsLate.length > 1 ? 'estão' : 'está'} de olho no relógio… 🐾`)
  // o índice da casa só diz algo no fim do dia (de manhã nada foi feito ainda)
  if ((s.chaos >= 70 && s.hour >= 18) || s.late >= 3) return say('preocupado', s.late ? `${s.late} coisa${s.late > 1 ? 's passaram' : ' passou'} do horário. Que tal 10 minutos juntas?` : 'A casa está pedindo um carinho. Um sprint curto resolve muito.')
  if (s.lowEnergy) return say('calma', s.next ? `Semana cansada: um passo de cada vez. Próximo: ${s.next}` : 'Semana cansada: um passo de cada vez 💛')
  if (s.total > 0 && s.done / s.total >= 0.5) return say('animado', `Mais da metade feita${hi}! Faltam ${left} 💪`)
  if (s.hour < 12) return say('feliz', s.next ? `Bom dia${hi}! Para começar: ${s.next}` : `Bom dia${hi}! Dia leve hoje ☀️`)
  return say('feliz', s.next ? `Próximo: ${s.next}` : left > 0 ? `Faltam ${left} hoje. Vamos?` : 'Tudo tranquilo por aqui 🪺')
}

/** Dicas quando a pessoa toca no Nino (gira uma por toque, a partir de uma que muda a cada dia). */
export const TIPS = [
  'Tarefa de 2 minutos? Faz agora e risca da lista.',
  'Dividir não é ajudar: a casa é das duas 🪺',
  'Beber água conta como autocuidado. Já tomou um copo?',
  'Em dia corrido, use o modo sobrevivência sem culpa.',
  'Um "obrigada" pelo que a outra fez vale mais que XP.',
  'Despeje tudo no "Organizar meu dia" e deixe a ordem comigo.',
  'Faxinão rende mais de cima para baixo e do seco para o molhado.',
  'Os cães agradecem rotina no mesmo horário 🐾',
]
export function tipFor(date: string, taps: number): string {
  const seed = Number(date.replace(/-/g, '')) % TIPS.length
  return TIPS[(seed + taps) % TIPS.length]
}
