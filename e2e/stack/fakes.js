// SÓ PARA TESTE LOCAL. Telegram falso (9555) e Anthropic falsa (9556): guardam as chamadas
// para os testes conferirem e respondem como as APIs de verdade, sem sair da máquina.
//   Telegram: POST /bot<token>/<método>  · GET /__calls · POST /__reset
//   Anthropic: POST /v1/messages (responde o próximo texto da fila, ou um padrão) · POST /__next {text} · GET /__calls · POST /__reset
const http = require('http')
const readBody = req => new Promise(r => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => r(d)) })
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }

let tg = [], msgId = 1000
http.createServer(async (req, res) => {
  const body = await readBody(req)
  if (req.url === '/__calls') return json(res, 200, tg)
  if (req.url === '/__reset') { tg = []; return json(res, 200, { ok: true }) }
  const m = req.url.match(/^\/bot[^/]+\/(\w+)/)
  if (!m) return json(res, 404, { ok: false })
  let parsed = {}; try { parsed = JSON.parse(body || '{}') } catch { /* form */ }
  tg.push({ method: m[1], body: parsed, at: Date.now() })
  if (m[1] === 'sendMessage') return json(res, 200, { ok: true, result: { message_id: ++msgId, chat: { id: parsed.chat_id }, text: parsed.text } })
  return json(res, 200, { ok: true, result: true })
}).listen(9555, () => console.log('Telegram falso na 9555'))

let ai = [], next = []
http.createServer(async (req, res) => {
  const body = await readBody(req)
  if (req.url === '/__calls') return json(res, 200, ai)
  if (req.url === '/__reset') { ai = []; next = []; return json(res, 200, { ok: true }) }
  if (req.url === '/__next') { next.push(JSON.parse(body || '{}').text || ''); return json(res, 200, { ok: true }) }
  if (req.url.startsWith('/v1/messages')) {
    let parsed = {}; try { parsed = JSON.parse(body || '{}') } catch { /* ok */ }
    ai.push({ body: parsed, at: Date.now() })
    const text = next.length ? next.shift() : '{"ok":true}'
    return json(res, 200, { id: 'msg_teste', type: 'message', role: 'assistant', model: parsed.model || 'teste', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } })
  }
  json(res, 404, { error: 'não existe no teste' })
}).listen(9556, () => console.log('Anthropic falsa na 9556'))

// Sobrou falso (9557): o resumo do mês com um vencimento hoje e o mês no vermelho
http.createServer((req, res) => {
  if (!req.url.startsWith('/api/resumo-ninho')) return json(res, 404, { error: 'não existe no teste' })
  if (req.headers.authorization !== 'Bearer token-de-teste-do-sobrou-local-123') return json(res, 401, { error: 'token' })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  json(res, 200, { resumo: { mes: today.slice(0, 7), renda: 5000, comprometido: 5400, pago: 1000, aPagar: 4400, sobraProjetada: -400, pctComprometido: 108,
    vencimentos: [{ titulo: 'Conta de luz teste', valor: 180.5, data: today, estimada: false }], avisos: [] } })
}).listen(9557, () => console.log('Sobrou falso na 9557'))
