// D3: plano da semana (Casa › Tarefas e Início; ajustar o dia e aprovar; 📅 na tarefa; Telegram com
// "✓ Aprovar plano") e jantar → lista de compras (o que falta e não está na despensa, com Desfazer).
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')
const { execSync } = require('child_process')
const fs = require('fs')
const S = (process.env.E2E_SHOTS || '/tmp/ninho-e2e/shots') + '/r57'; fs.rmSync(S, { recursive: true, force: true }); fs.mkdirSync(S, { recursive: true })
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [__dirname + '/..'] }), 'utf8')
const APP = 'http://localhost:3124', TG = 'http://localhost:9555', H = '11111111-1111-1111-1111-111111111111'
const PSQL = 'runuser -u postgres -- /usr/lib/postgresql/16/bin/psql -X -h localhost -p 54330 -U postgres -d ninho'
const sql = q => execSync(`${PSQL} -At -c "${q.replace(/"/g, '\\"')}"`).toString().trim()
let fails = 0
const check = (c, m) => { console.log((c ? '  ok - ' : '  FALHOU - ') + m); if (!c) fails++ }
const errs = [], wait = ms => new Promise(r => setTimeout(r, ms))
const cron = path => fetch(APP + path, { headers: { authorization: 'Bearer segredo-do-cron-local' } })
const tgCalls = async () => (await fetch(TG + '/__calls')).json()
const hook = update => fetch(APP + '/api/telegram/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'segredo-webhook-local' }, body: JSON.stringify(update) })
const axe = async (p, sel) => { await p.addScriptTag({ content: AXE }); return p.evaluate(async s => (await window.axe.run(document.querySelector(s), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => `${v.id}(${v.nodes.length})`), sel) }
const casaSub = async (pg, t) => { const g = /Despensa|Jantar|^Lista$/.test(t) ? 'Compras' : null
  if (g) { await pg.locator('.subtab', { hasText: g }).first().click(); await wait(350) }
  await ((await pg.locator('.casa-sub .fc', { hasText: t }).count()) ? pg.locator('.casa-sub .fc', { hasText: t }) : pg.locator('.subtab', { hasText: t })).first().click() }
;(async () => {
  sql(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c0c1','giovanna@ninho.test'),('00000000-0000-0000-0000-00000000c0c2','sabrina@ninho.test') on conflict do nothing`)
  sql(`select public.ninho_link_member('giovanna@ninho.test','g','${H}')`); sql(`select public.ninho_link_member('sabrina@ninho.test','s','${H}')`)
  execSync(`${PSQL} -q -v ON_ERROR_STOP=1 -f /tmp/ninho-sql-ro/migrations/20261011120100_rls_por_casa.sql 2>/dev/null`)
  sql(`insert into household_setup (household_id, completed_at, completed_by) values ('${H}', now(), 'g') on conflict do nothing`)
  const TODAY = sql(`select public.ninho_today()`)
  const DOW = Number(sql(`select extract(isodow from '${TODAY}'::date)`)) // 1 = seg … 7 = dom
  const WS = DOW === 7 ? sql(`select ('${TODAY}'::date + 1)::text`) : sql(`select date_trunc('week', '${TODAY}'::date)::date::text`)
  const P1 = '57575757-0000-0000-0000-000000000001', P2 = '57575757-0000-0000-0000-000000000002'
  // só as nossas semanais (as do banco de teste ficam feitas, para o plano ficar pequeno)
  sql(`update tasks set active=false where household_id='${H}' and frequency in ('weekly','biweekly','monthly')`)
  sql(`insert into tasks (id, household_id, title, category, frequency, assigned_to, weight, created_at) values
    ('${P1}','${H}','Faxina plano','bathroom','weekly','g','heavy', now() - interval '40 days'),
    ('${P2}','${H}','Lavar roupa plano','laundry','weekly','s','medium', now() - interval '40 days')`)

  const b = require('../lib/mute-agua.js')(await chromium.launch())
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' })
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept())
  await p.goto(APP); await p.waitForSelector('#lg-email')
  await p.fill('#lg-email', 'giovanna@ninho.test'); await p.fill('#lg-pw', 'senha-gio-123'); await p.locator('.lg-b').click()
  await p.waitForSelector('.pcard:not([data-hide="1"])'); await wait(1500)

  console.log('1. Plano da semana no Início (domingo a terça)')
  const home = await p.locator('.card.plan').count()
  check([7, 1, 2].includes(DOW) ? home === 1 : home === 0, `cartão no Início só de domingo a terça (hoje isodow ${DOW}: ${home})`)

  console.log('2. Casa › Tarefas: planejar, ajustar e aprovar')
  await p.locator('.bnb', { hasText: 'Casa' }).first().click(); await wait(800)
  await p.locator('.plan-open').click(); await wait(500)
  const card = p.locator('.card.plan').last()
  const titles = await card.locator('.plan-t b').allInnerTexts()
  check(titles.includes('Faxina plano') && titles.includes('Lavar roupa plano'), 'a sugestão traz as tarefas da semana: ' + titles.join(' · '))
  const v = await axe(p, '.card.plan'); check(v.length === 0, 'axe sem problemas no plano' + (v.length ? ': ' + v.join(', ') : ''))
  await card.screenshot({ path: S + '/01-plano.png' })
  const sel = card.locator('li', { hasText: 'Faxina plano' }).locator('select')
  const opts = await sel.locator('option').evaluateAll(os => os.map(o => o.value))
  const chosen = opts[opts.length - 1]
  await sel.selectOption(chosen); await wait(200)
  await card.locator('.btn-p', { hasText: 'Aprovar plano' }).click(); await wait(1800)
  check(sql(`select date::text from week_plan where task_id='${P1}' and week_start='${WS}'`) === chosen, `o dia ajustado foi gravado (${chosen})`)
  check(sql(`select count(*) from week_plan where task_id='${P2}' and week_start='${WS}'`) === '1', 'a outra tarefa também')
  check(/aprovado/.test(await p.locator('.plan-open').innerText().catch(() => '')) || await p.locator('.card.plan', { hasText: 'aprovado' }).count() > 0, 'o plano aparece como aprovado')

  console.log('3. A tarefa no Início')
  if (WS === sql(`select date_trunc('week', '${TODAY}'::date)::date::text`)) {
    // semana atual: a tarefa mostra o dia; no dia dela sobe para "hoje"
    sql(`update week_plan set date='${TODAY}' where task_id='${P1}'`)
    await p.reload(); await p.waitForSelector('.pcard:not([data-hide="1"])'); await wait(1500)
    const row = p.locator('.tr:visible', { has: p.locator('.trt', { hasText: 'Faxina plano' }) }).first()
    check(/📅 hoje/.test(await row.innerText().catch(() => '')), 'a tarefa mostra "📅 hoje"')
    const grp = await row.evaluate(el => { let n = el; while (n && !n.previousElementSibling?.classList?.contains('grp-h') && n.parentElement) n = n.parentElement; return document.body.innerText.includes('HOJE, A QUALQUER HORA') })
    check(grp, 'e está em "Hoje, a qualquer hora"')
  } else console.log('  (domingo: o plano é da próxima semana; a tarefa ainda não muda)')
  await b.close()

  console.log('4. Telegram: plano no resumo de domingo e ✓ Aprovar plano')
  sql(`delete from week_plan`)
  sql(`insert into telegram_links (household_id, who, chat_id, linked_at, active, weekly, tasks, evening) values ('${H}','g',957,now(),true,true,true,true)`)
  await fetch(TG + '/__reset')
  await cron('/api/cron/weekly')
  const m = (await tgCalls()).filter(c => c.method === 'sendMessage' && c.body.chat_id === 957).find(c => /Plano da semana/.test(c.body.text))
  check(!!m && /Faxina plano \(Giovanna\)/.test(m.body.text) && /Lavar roupa plano \(Sabrina\)/.test(m.body.text), 'o resumo traz o plano: ' + (m ? m.body.text.split('🗓')[1]?.replace(/\n/g, ' / ').slice(0, 160) : 'nada'))
  check(!!m && JSON.stringify(m.body.reply_markup || {}).includes(`wp:${WS}`), 'com "✓ Aprovar plano"')
  await fetch(TG + '/__reset')
  await hook({ update_id: 5701, callback_query: { id: 'cq57', from: { id: 957 }, data: `wp:${WS}`, message: { message_id: 91, chat: { id: 957 }, text: 'Resumo' } } }); await wait(1000)
  check(sql(`select count(*) from week_plan where week_start='${WS}' and task_id in ('${P1}','${P2}')`) === '2', 'aprovar no Telegram grava o plano')
  const ans = (await tgCalls()).find(c => c.method === 'sendMessage')
  check(ans && /Plano aprovado/.test(ans.body.text), 'e confirma: ' + (ans ? ans.body.text : ''))

  console.log('5. Jantar → lista de compras')
  sql(`insert into personal_recipes (household_id, who, name, servings, items, kcal) values ('${H}','g','Frango com batata teste',2,'[{"name":"Peito de frango","food_id":null,"qty":500,"unit":"g","g":500,"kcal":500,"p":0,"c":0,"f":0,"text":"500 g peito de frango"},{"name":"Batata","food_id":null,"qty":1000,"unit":"g","g":1000,"kcal":700,"p":0,"c":0,"f":0,"text":"1 kg batata"},{"name":"Cebola roxa","food_id":null,"qty":100,"unit":"g","g":100,"kcal":40,"p":0,"c":0,"f":0,"text":"100 g cebola"}]'::jsonb,1240)`)
  sql(`insert into pantry_items (household_id, name, place, expires_on) values ('${H}','Frango desfiado','geladeira', '${TODAY}'::date + 5)`)
  sql(`delete from shopping_items where household_id='${H}' and lower(title) in ('batata','cebola roxa','peito de frango')`)
  const b2 = require('../lib/mute-agua.js')(await chromium.launch())
  const c2 = await b2.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' })
  const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message)); q.on('dialog', d => d.accept())
  await q.goto(APP); await q.waitForSelector('#lg-email')
  await q.fill('#lg-email', 'giovanna@ninho.test'); await q.fill('#lg-pw', 'senha-gio-123'); await q.locator('.lg-b').click()
  await q.waitForSelector('.pcard:not([data-hide="1"])'); await wait(1500)
  await q.locator('.bnb', { hasText: 'Casa' }).first().click(); await wait(700)
  await casaSub(q, 'Jantar'); await wait(1000)
  // planeja o jantar de hoje (a semana do jantar vai de segunda a domingo; o banco de teste não tem jantares)
  const slot = q.locator('.jt-today .jt-m')
  await slot.click(); await wait(500)
  await q.locator('.jt-form input.fi').first().fill('Frango com batata teste'); await wait(500)
  const box = q.locator('.jt-shop')
  check(await box.count() === 1 && await box.locator('input').isChecked(), '"Mandar o que falta para a lista" aparece marcado')
  const bt = (await box.innerText()).replace(/\s+/g, ' ')
  check(/2 para comprar/.test(bt) && /já na despensa: Peito de frango/.test(bt), 'mostra o que comprar e o que já tem: ' + bt)
  await q.locator('.jt-form').screenshot({ path: S + '/02-jantar.png' })
  await q.locator('.jt-form .btn-p').click(); await wait(2000)
  const shop = sql(`select string_agg(title, ',' order by title) from shopping_items where household_id='${H}' and done_at is null and lower(title) in ('batata','cebola roxa','peito de frango')`)
  check(shop === 'Batata,Cebola roxa', 'foram para a lista só Batata e Cebola roxa (frango tem na despensa): ' + shop)
  const toast = q.locator('.toast')
  check(/🛒 2 na lista/.test(await toast.innerText().catch(() => '')), 'o aviso conta o que foi para a lista')
  await toast.locator('button', { hasText: 'Desfazer' }).click(); await wait(1500)
  check(sql(`select count(*) from shopping_items where household_id='${H}' and done_at is null and lower(title) in ('batata','cebola roxa')`) === '0', 'Desfazer tira da lista')
  check(sql(`select count(*) from house_meals where household_id='${H}' and title='Frango com batata teste'`) === '1', 'e o jantar continua planejado')
  await b2.close()

  check(errs.length === 0, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''))
  console.log(fails ? `== r57: ${fails} FALHA(S)` : '== r57: TUDO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); console.log('== r57: ERRO'); process.exit(1) })
