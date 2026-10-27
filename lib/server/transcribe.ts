// Áudio do Telegram → texto (Groq, Whisper). SÓ servidor: usa GROQ_API_KEY e TELEGRAM_BOT_TOKEN.
// O áudio fica só na memória durante a transcrição; nada é guardado.
import { createTg } from './tg'

/** Áudio mais longo que isso não é transcrito (custo e tempo de resposta). */
export const MAX_AUDIO_SEC = 180
const MAX_BYTES = 10_000_000

export const groqConfigured = (env = process.env) => !!env.GROQ_API_KEY

export async function transcribeTelegram(env: NodeJS.ProcessEnv, fileId: string): Promise<string | null> {
  const base = env.TELEGRAM_API_BASE || 'https://api.telegram.org'
  const info = await createTg(env)('getFile', { file_id: fileId })
  const path = info.ok ? String(info.result?.file_path || '') : ''
  if (!path || (info.result?.file_size || 0) > MAX_BYTES) return null
  const r = await fetch(`${base}/file/bot${env.TELEGRAM_BOT_TOKEN}/${path}`, { cache: 'no-store' })
  if (!r.ok) return null
  const buf = await r.arrayBuffer()
  if (buf.byteLength > MAX_BYTES) return null
  const form = new FormData()
  form.append('file', new Blob([buf], { type: 'audio/ogg' }), path.split('/').pop() || 'audio.ogg')
  form.append('model', env.GROQ_MODEL || 'whisper-large-v3-turbo')
  form.append('language', 'pt')
  form.append('response_format', 'json')
  // GROQ_API_BASE só existe para testes locais (receptor falso)
  const g = await fetch(`${env.GROQ_API_BASE || 'https://api.groq.com/openai/v1'}/audio/transcriptions`, {
    method: 'POST', headers: { authorization: `Bearer ${env.GROQ_API_KEY}` }, body: form, cache: 'no-store',
  })
  if (!g.ok) { console.error('[ninho] transcrição', g.status, (await g.text().catch(() => '')).slice(0, 200)); return null }
  const text = String(((await g.json().catch(() => ({}))) as any).text || '').trim()
  return text ? text.slice(0, 1500) : null
}
