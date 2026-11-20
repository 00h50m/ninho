// SÓ PARA TESTE LOCAL: chave anônima e de serviço (JWT) assinadas com o segredo de teste.
const crypto = require('crypto')
const SECRET = process.env.E2E_JWT_SECRET || 'segredo-jwt-de-teste-local-com-32-caracteres-ou-mais'
const b64 = b => Buffer.from(b).toString('base64url')
module.exports = role => {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const pl = b64(JSON.stringify({ role, iss: 'ninho-teste', iat: 1700000000, exp: 4100000000 }))
  return `${head}.${pl}.${crypto.createHmac('sha256', SECRET).update(`${head}.${pl}`).digest('base64url')}`
}
