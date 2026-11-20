// C3: tarefa sem horário lembra na hora em que a dona costuma fazer (aprende com as últimas 4 semanas),
// no Telegram com ✓ Feito / ⤼ Não deu; só da dona, só se não foi feita, desligável. Guia e "O que mudou".
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')
const { execSync } = require('child_process')
const fs = require('fs')
const S = (process.env.E2E_SHOTS || '/tmp/ninho-e2e/shots') + '/r54'; fs.rmSync(S, { recursive: true, force: true }); fs.mkdirSync(S, { recursive: true })
const APP = 'http://localhost:3124', TG = 'http://localhost:9555', H = '11111111-1111-1111-1111-111111111111'
const PSQL = 'runuser -u postgres -- /usr/lib/postgresql/16/bin/psql -X -h localhost -p 54330 -U postgres -d ninho'
const sql = q => execSync(`${PSQL} -At -c "${q.replace(/"/g, '\\"')}"`).toString().trim()
let fails = 0
const check = (c, m) => { console.log((c ? '  ok - ' : '  FALHOU - ') + m); if (!c) fails++ }
const errs = [], wait = ms => new Promise(r => setTimeout(r, ms))
const cron = q => fetch(APP + '/api/cron/reminders' + q, { headers: { authorization: 'Bearer segredo-do-cron-local' } })
const at = (date, hm) => new Date(`${date}T${hm}:00-03:00`).toISOString()
const tgCalls = async () => (await fetch(TG + '/__calls')).json()
const sent = async (chat, prefix) => (await tgCalls()).filter(c => c.method === 'sendMessage' && c.body.chat_id === chat && c.body.text.startsWith(prefix))
;(async () => {
  sql(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c0c1','giovanna@ninho.test'),('00000000-0000-0000-0000-00000000c0c2','sabrina@ninho.test') on conflict do nothing`)
  sql(`select public.ninho_link_member('giovanna@ninho.test','g','${H}')`); sql(`select public.ninho_link_member('sabrina@ninho.test','s','${H}')`)
  execSync(`${PSQL} -q -v ON_ERROR_STOP=1 -f /tmp/ninho-sql-ro/migrations/20261011120100_rls_por_casa.sql 2>/dev/null`)
  sql(`insert into household_setup (household_id, completed_at, completed_by) values ('${H}', now(), 'g') on conflict do nothing`)
  const TODAY = sql(`select public.ninho_today()`)
  const day = n => sql(`select ('${TODAY}'::date - ${n})::text`)
  const T1 = '54545454-0000-0000-0000-000000000001', T2 = '54545454-0000-0000-0000-000000000002', T3 = '54545454-0000-0000-0000-000000000003'
  sql(`insert into tasks (id, household_id, title, category, frequency, assigned_to, essential, created_at) values
    ('${T1}','${H}','Varal teste','general','daily','g',false, now() - interval '40 days'),
    ('${T2}','${H}','Sabrina teste','general','daily','g',false, now() - interval '40 days'),
    ('${T3}','${H}','Poucas vezes teste','general','daily','g',false, now() - interval '40 days')`)
  // Varal: Giovanna fez 3 vezes por volta das 08:00. "Sabrina teste": quem fez foi a Sabrina (a dona hoje é a Giovanna).
  const done = (t, n, hm, by) => sql(`insert into task_completions (task_id, household_id, completed_by, date, created_at) values ('${t}','${H}','${by}','${day(n)}','${at(day(n), hm)}')`)
  done(T1, 1, '07:55', 'g'); done(T1, 2, '08:05', 'g'); done(T1, 3, '08:00', 'g')
  done(T2, 1, '08:00', 's'); done(T2, 2, '08:00', 's'); done(T2, 3, '08:00', 's')
  done(T3, 1, '08:00', 'g'); done(T3, 2, '08:00', 'g')
  sql(`insert into telegram_links (household_id, who, chat_id, linked_at, active, tasks, evening) values ('${H}','g',954,now(),true,true,true),('${H}','s',955,now(),true,true,true)`)

  console.log('1. Lembrete na hora de costume')
  await fetch(TG + '/__reset')
  await cron(`?now=${at(TODAY, '06:30')}`)
  check((await sent(954, '🕰')).length === 0, 'antes da hora de costume: nada')
  await cron(`?now=${at(TODAY, '08:02')}`)
  const m = await sent(954, '🕰 Varal teste')
  check(m.length === 1 && /costuma fazer por volta das 08:00/.test(m[0].body.text), 'às 08:02 chega "🕰 Varal teste" para a Giovanna' + (m[0] ? ' · ' + m[0].body.text.replace(/\n/g, ' / ') : ''))
  const kb = m[0] ? JSON.stringify(m[0].body.reply_markup || {}) : ''
  check(kb.includes('rt:' + T1) && kb.includes('nd:' + T1), 'com ✓ Feito e ⤼ Não deu')
  check((await sent(954, '🕰 Sabrina teste')).length === 0, 'não usa o costume da outra pessoa')
  check((await sent(954, '🕰 Poucas vezes teste')).length === 0, 'com só 2 vezes ainda não lembra')
  check((await sent(955, '🕰')).length === 0, 'a Sabrina não recebe o lembrete da Giovanna')
  await cron(`?now=${at(TODAY, '08:12')}`)
  check((await sent(954, '🕰 Varal teste')).length === 1, 'uma vez só no dia')

  console.log('2. Feita ou desligada: nada')
  sql(`delete from telegram_log`); await fetch(TG + '/__reset')
  sql(`insert into task_completions (task_id, household_id, completed_by, date) values ('${T1}','${H}','g','${TODAY}')`)
  await cron(`?now=${at(TODAY, '08:03')}`)
  check((await sent(954, '🕰 Varal teste')).length === 0, 'já feita hoje: não lembra')
  sql(`delete from task_completions where task_id='${T1}' and date='${TODAY}'`); sql(`delete from telegram_log`); await fetch(TG + '/__reset')
  sql(`update telegram_links set tasks=false where chat_id=954`)
  await cron(`?now=${at(TODAY, '08:04')}`)
  check((await sent(954, '🕰')).length === 0, 'com os lembretes de tarefa desligados no Telegram: nada')

  console.log('3. App: Ajustes, guia e "O que mudou"')
  const b = require('../lib/mute-agua.js')(await chromium.launch())
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' })
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message))
  await p.goto(APP); await p.waitForSelector('#lg-email')
  await p.fill('#lg-email', 'giovanna@ninho.test'); await p.fill('#lg-pw', 'senha-gio-123'); await p.locator('.lg-b').click()
  await p.waitForSelector('.pcard', { timeout: 20000 }); await wait(1500)
  const news = p.locator('#novidades')
  check(await news.count() === 1 && /Mais tarde/.test(await news.innerText()) && /Foco/.test(await news.innerText()), '"O que mudou" conta as novidades')
  await news.screenshot({ path: S + '/01-novidades.png' })
  await news.locator('button', { hasText: 'Ver o guia completo' }).click(); await wait(1000)
  const guia = await p.locator('main').evaluate(e => e.textContent)
  check(/Tarefas sem horário:.*3 vezes/s.test(guia), 'o guia explica o lembrete de costume')
  check(errs.length === 0, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''))
  await b.close()
  console.log(fails ? `== r54: ${fails} FALHA(S)` : '== r54: TUDO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); console.log('== r54: ERRO'); process.exit(1) })
