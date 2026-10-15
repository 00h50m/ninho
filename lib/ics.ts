// Agenda da casa no celular (035): o calendário em formato iCalendar (.ics) que o Google Agenda
// e o calendário do iPhone assinam por um link secreto. Puro, testado.
// Só vai o essencial (título, data, hora e tipo): sem observações, links ou valores.
import { addDays } from './dates'
import { kindIcon, kindLabel, type HouseEvent } from './agenda'
import { upcomingCare, type HealthRecord } from './caes'

export interface IcsItem { uid: string, date: string, time: string | null, end?: string | null, title: string, desc: string }

/** Texto seguro para o .ics (barra, ponto e vírgula, vírgula e quebras de linha escapados). */
export const icsText = (s: string) => s.replace(/[\\;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n').replace(/[\u0000-\u001f]/g, '')

/** Linhas de no máximo 75 bytes (as seguintes começam com espaço), sem cortar letras acentuadas. */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = '', size = 0, max = 75
  for (const ch of Array.from(line)) {
    const n = enc.encode(ch).length
    if (size + n > max) { out.push(cur); cur = ''; size = 0; max = 74 }
    cur += ch; size += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const ymd = (d: string) => d.replace(/-/g, '')
const hms = (t: string) => t.slice(0, 5).replace(':', '') + '00'
/** Hora seguinte (eventos com horário duram 1 h; 23h vira 23h59). */
const plus1h = (t: string) => { const h = Number(t.slice(0, 2)); return h >= 23 ? '235900' : `${String(h + 1).padStart(2, '0')}${t.slice(3, 5)}00` }

/** O calendário completo. `stamp` = agora em UTC (AAAAMMDDTHHMMSSZ). */
export function icsCalendar(name: string, items: IcsItem[], stamp: string): string {
  const L: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ninho//Agenda da casa//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(name)}`, 'X-WR-TIMEZONE:America/Sao_Paulo', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    // o Brasil não tem horário de verão desde 2019
    'BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE',
  ]
  for (const it of items) {
    L.push('BEGIN:VEVENT', `UID:${it.uid}@ninho`, `DTSTAMP:${stamp}`)
    if (it.time) L.push(`DTSTART;TZID=America/Sao_Paulo:${ymd(it.date)}T${hms(it.time)}`, `DTEND;TZID=America/Sao_Paulo:${ymd(it.date)}T${it.end && it.end.slice(0, 5) > it.time.slice(0, 5) ? hms(it.end) : plus1h(it.time)}`)
    else L.push(`DTSTART;VALUE=DATE:${ymd(it.date)}`, `DTEND;VALUE=DATE:${ymd(addDays(it.date, 1))}`)
    L.push(`SUMMARY:${icsText(it.title)}`, `DESCRIPTION:${icsText(it.desc)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT')
  }
  L.push('END:VCALENDAR')
  return L.map(foldLine).join('\r\n') + '\r\n'
}

/**
 * O que entra: eventos da casa de 30 dias atrás a 1 ano à frente (vencimentos só os pendentes),
 * manutenções que vencem e os próximos cuidados dos cães.
 */
export function agendaItems(o: {
  today: string, events: HouseEvent[], maint: Array<{ id: string, title: string, next_due: string }>
  health: HealthRecord[], dogs: Array<{ id: string, name: string }>
}): IcsItem[] {
  const from = addDays(o.today, -30), until = addDays(o.today, 365)
  const ev: IcsItem[] = o.events
    .filter(e => e.date >= from && e.date <= until && !(e.kind === 'vencimento' && e.paid))
    .map(e => ({ uid: `ev-${e.id}`, date: e.date, time: /^\d{2}:\d{2}/.test(e.time || '') ? e.time : null, end: e.end_time || null, title: `${kindIcon(e.kind)} ${e.title}`, desc: `${kindLabel(e.kind)} · Ninho` }))
  const mt: IcsItem[] = o.maint
    .filter(m => m.next_due >= from && m.next_due <= until)
    .map(m => ({ uid: `mt-${m.id}-${m.next_due}`, date: m.next_due, time: null, title: `🔧 ${m.title}`, desc: 'Manutenção da casa · Ninho' }))
  const name = (id: string) => o.dogs.find(d => d.id === id)?.name
  const dg: IcsItem[] = upcomingCare(o.health, o.today, 365)
    .filter(r => name(r.dog_id) && r.next_date! >= from)
    .map(r => ({ uid: `dg-${r.id}`, date: r.next_date!, time: null, title: `🐾 ${name(r.dog_id)}: ${r.title}`, desc: 'Cuidado dos cães · Ninho' }))
  return [...ev, ...mt, ...dg].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99'))
}

/** Segredo do link: 48 letras hexadecimais. */
export const ICS_TOKEN = /^[a-f0-9]{48}$/
