// SÓ PARA TESTE LOCAL. Imita o mínimo do Supabase na porta 54321:
// · /auth/v1/*  login por e-mail e senha (as senhas ficam em auth.users.encrypted_password do banco
//               de teste, em texto: nunca usar isto fora daqui), usuário, sair, renovar sessão e cadastro;
// · /rest/v1/*  repassa para o PostgREST (porta 3001);
// · o resto (tempo real, arquivos) responde 404 e o app segue sem.
// Os tokens são JWT HS256 assinados com o segredo de teste, o mesmo do PostgREST.
const http = require('http'), crypto = require('crypto'), { execFileSync } = require('child_process')
const SECRET = process.env.E2E_JWT_SECRET || 'segredo-jwt-de-teste-local-com-32-caracteres-ou-mais'
const PG = ['-X', '-At', '-h', 'localhost', '-p', process.env.E2E_PG_PORT || '54330', '-U', 'postgres', '-d', 'ninho']
const REST = { host: 'localhost', port: Number(process.env.E2E_REST_PORT || 3001) }

const b64 = b => Buffer.from(b).toString('base64url')
function sign(payload, ttl = 3600) {
  const now = Math.floor(Date.now() / 1000)
  const body = { aud: 'authenticated', iat: now, exp: now + ttl, ...payload }
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), pl = b64(JSON.stringify(body))
  return `${head}.${pl}.${crypto.createHmac('sha256', SECRET).update(`${head}.${pl}`).digest('base64url')}`
}
function verify(tok) {
  const [h, p, s] = String(tok || '').split('.')
  if (!s || crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null
  const c = JSON.parse(Buffer.from(p, 'base64url').toString())
  return c.exp && c.exp < Date.now() / 1000 ? null : c
}
// consulta de uma linha só no banco de teste (valores passados como variáveis do psql, sem montar SQL com texto)
// (o SQL vai pela entrada padrão: no -c o psql não troca as variáveis :'v')
const q = (sql, vars = {}) => execFileSync('runuser', ['-u', 'postgres', '--', 'psql', ...PG, '-v', 'ON_ERROR_STOP=1', ...Object.entries(vars).flatMap(([k, v]) => ['-v', `${k}=${v}`])], { encoding: 'utf8', input: sql }).trim()
const userBy = (field, value) => {
  const r = q(`select id || '|' || coalesce(email,'') || '|' || coalesce(encrypted_password,'') || '|' || created_at from auth.users where ${field === 'id' ? 'id::text' : 'lower(email)'} = lower(:'v') limit 1`, { v: value })
  if (!r) return null
  const [id, email, pass, created] = r.split('|')
  return { id, email, pass, created_at: created }
}
const userJson = u => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: u.created_at, email_confirmed_at: u.created_at })
const session = u => {
  const access = sign({ sub: u.id, email: u.email, role: 'authenticated' })
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: b64(JSON.stringify({ sub: u.id, n: crypto.randomUUID() })), user: userJson(u) }
}

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range, content-profile, x-total-count' }
const send = (res, code, body) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(body == null ? '' : JSON.stringify(body)) }
const readBody = req => new Promise(r => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => r(d)) })

http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
    const url = new URL(req.url, 'http://x')
    if (url.pathname.startsWith('/rest/v1')) {
      const body = await readBody(req)
      const headers = { ...req.headers, host: `${REST.host}:${REST.port}` }
      // supabase-js manda a chave anônima em "apikey" e a sessão em Authorization
      if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`
      const p = http.request({ ...REST, method: req.method, path: url.pathname.replace('/rest/v1', '') + url.search, headers }, r => {
        res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res)
      })
      p.on('error', e => send(res, 502, { message: String(e.message) }))
      return p.end(body)
    }
    if (url.pathname.startsWith('/auth/v1')) {
      const path = url.pathname.slice('/auth/v1'.length)
      const body = req.method === 'GET' ? {} : JSON.parse((await readBody(req)) || '{}')
      if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
        const u = userBy('email', body.email || '')
        // sem senha gravada: aceita qualquer uma com 6 ou mais (contas criadas pelos testes direto no banco)
        if (!u || !body.password || (u.pass ? u.pass !== body.password : String(body.password).length < 6)) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' })
        return send(res, 200, session(u))
      }
      if (path === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
        let sub = null; try { sub = JSON.parse(Buffer.from(body.refresh_token || '', 'base64url').toString()).sub } catch { /* inválido */ }
        const u = sub && userBy('id', sub)
        return u ? send(res, 200, session(u)) : send(res, 400, { error: 'invalid_grant', msg: 'Invalid Refresh Token' })
      }
      if (path === '/signup') {
        if (!body.email || !body.password || String(body.password).length < 6) return send(res, 422, { code: 'weak_password', msg: 'Password should be at least 6 characters.' })
        if (userBy('email', body.email)) return send(res, 422, { code: 'user_already_exists', msg: 'User already registered' })
        q(`insert into auth.users (id, email, encrypted_password) values (gen_random_uuid(), lower(:'e'), :'p')`, { e: body.email, p: body.password })
        return send(res, 200, session(userBy('email', body.email)))
      }
      const claims = verify((req.headers.authorization || '').replace(/^Bearer /i, ''))
      if (path === '/user') { const u = claims?.sub && userBy('id', claims.sub); return u ? send(res, 200, userJson(u)) : send(res, 401, { msg: 'invalid JWT' }) }
      if (path === '/logout') { res.writeHead(204, cors); return res.end() }
      return send(res, 404, { msg: 'não existe no teste' })
    }
    return send(res, 404, { msg: 'não existe no teste' })
  } catch (e) { send(res, 500, { msg: String(e && e.message || e) }) }
}).listen(Number(process.env.E2E_GATEWAY_PORT || 54321), () => console.log('gateway de teste na 54321'))

module.exports = { sign }
