// D1: "⏰ Mais tarde" (app e Telegram), voltar ao horário de sempre, a edição não grava o horário de hoje,
// e o horário de costume no ⋯ com "Fixar".
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')
const { execSync } = require('child_process')
const fs = require('fs')
const S = (process.env.E2E_SHOTS || '/tmp/ninho-e2e/shots') + '/r55'; fs.rmSync(S, { recursive: true, force: true }); fs.mkdirSync(S, { recursive: true })
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [__dirname + '/..'] }), 'utf8')
const APP = 'http://localhost:3124', TG = 'http://localhost:9555', H = '11111111-1111-1111-1111-111111111111'
const PSQL = 'runuser -u postgres -- /usr/lib/postgresql/16/bin/psql -X -h localhost -p 54330 -U postgres -d ninho'
const sql = q => execSync(`${PSQL} -At -c "${q.replace(/"/g, '\\"')}"`).toString().trim()
let fails = 0
const check = (c, m) => { console.log((c ? '  ok - ' : '  FALHOU - ') + m); if (!c) fails++ }
const errs = [], wait = ms => new Promise(r => setTimeout(r, ms))
const cron = q => fetch(APP + '/api/cron/reminders' + q, { headers: { authorization: 'Bearer segredo-do-cron-local' } })
const at = (date, hm) => new Date(`${date}T${hm}:00-03:00`).toISOString()
const tgCalls = async () => (await fetch(TG + '/__calls')).json()
const hook = update => fetch(APP + '/api/telegram/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'segredo-webhook-local' }, body: JSON.stringify(update) })
// mesmas contas de lib/maisTarde.ts
const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }
const fromMin = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const laterAt = (hm, min) => { const n = Math.ceil((toMin(hm) + min) / 5) * 5; return n > toMin('23:30') ? null : fromMin(n) }
;(async () => {
  sql(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c0c1','giovanna@ninho.test'),('00000000-0000-0000-0000-00000000c0c2','sabrina@ninho.test') on conflict do nothing`)
  sql(`select public.ninho_link_member('giovanna@ninho.test','g','${H}')`); sql(`select public.ninho_link_member('sabrina@ninho.test','s','${H}')`)
  execSync(`${PSQL} -q -v ON_ERROR_STOP=1 -f /tmp/ninho-sql-ro/migrations/20261011120100_rls_por_casa.sql 2>/dev/null`)
  sql(`insert into household_setup (household_id, completed_at, completed_by) values ('${H}', now(), 'g') on conflict do nothing`)
  const TODAY = sql(`select public.ninho_today()`), day = n => sql(`select ('${TODAY}'::date - ${n})::text`)
  const T1 = '55555555-0000-0000-0000-000000000001', T2 = '55555555-0000-0000-0000-000000000002', T3 = '55555555-0000-0000-0000-000000000003'
  sql(`insert into tasks (id, household_id, title, category, frequency, assigned_to, scheduled_time, essential, created_at) values
    ('${T1}','${H}','Varal teste','general','daily','g','23:50',false, now() - interval '40 days'),
    ('${T2}','${H}','Lixo teste','general','daily','g',null,false, now() - interval '40 days'),
    ('${T3}','${H}','Regar teste','general','daily','g','09:00',false, now() - interval '40 days')`)
  for (const [n, hm] of [[1, '07:55'], [2, '08:05'], [3, '08:00']]) sql(`insert into task_completions (task_id, household_id, completed_by, date, created_at) values ('${T2}','${H}','g','${day(n)}','${at(day(n), hm)}')`)

  const b = require('../lib/mute-agua.js')(await chromium.launch())
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' })
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept())
  await p.goto(APP); await p.waitForSelector('#lg-email')
  await p.fill('#lg-email', 'giovanna@ninho.test'); await p.fill('#lg-pw', 'senha-gio-123'); await p.locator('.lg-b').click()
  await p.waitForSelector('.pcard:not([data-hide="1"])'); await wait(1500)
  const row = t => p.locator('.tr:visible', { has: p.locator('.trt', { hasText: t }) })
  const menu = async t => { await row(t).first().locator('.ib.mob').click(); await wait(500) }
  const nowHM = await p.evaluate(() => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))

  console.log('1. Mais tarde no app')
  await menu('Varal teste')
  const h1 = laterAt(nowHM, 60)
  if (!h1) {
    check(await p.locator('.modal .btn', { hasText: 'Mais tarde' }).count() === 0, `perto da meia-noite (${nowHM}): sem "Mais tarde"`)
    await p.keyboard.press('Escape'); await wait(300)
    sql(`insert into task_later (household_id, task_id, date, at, by_who) values ('${H}','${T1}','${TODAY}','23:55','g')`)
    await p.reload(); await p.waitForSelector('.pcard:not([data-hide="1"])'); await wait(1500)
  } else {
    await p.locator('.modal .btn', { hasText: 'Mais tarde' }).click(); await wait(300)
    const opts = await p.locator('.later-opts .fc').allInnerTexts()
    check(opts.length >= 1 && opts[0].includes(h1), `opções de horário (${opts.join(' · ')})`)
    await p.screenshot({ path: S + '/01-opcoes.png' })
    await p.addScriptTag({ content: AXE })
    const v = await p.evaluate(async () => (await window.axe.run(document.querySelector('.modal'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => v.id))
    check(v.length === 0, 'axe sem problemas no menu' + (v.length ? ': ' + v.join(', ') : ''))
    await p.locator('.later-opts .fc').first().click(); await wait(1500)
    check(sql(`select at::text || '/' || by_who from task_later where task_id='${T1}' and date='${TODAY}'`) === `${h1}:00/g`, `grava o horário de hoje (${h1}), por Giovanna`)
    check(sql(`select scheduled_time::text from tasks where id='${T1}'`).slice(0, 5) === '23:50', 'o horário de sempre não muda')
  }
  const tag = await row('Varal teste').first().locator('.tag-t').innerText().catch(() => '')
  check(/mais tarde/.test(tag), 'a linha mostra "mais tarde" · ' + tag)
  await row('Varal teste').first().screenshot({ path: S + '/02-linha.png' })

  console.log('2. Editar não grava o horário de hoje')
  await menu('Varal teste')
  await p.locator('.modal .btn', { hasText: 'Editar tarefa' }).click(); await wait(700)
  const tv = await p.locator('.modal input[type=time]').first().inputValue().catch(() => '')
  check(tv === '23:50', 'o formulário mostra o horário de sempre (' + tv + ')')
  await p.keyboard.press('Escape'); await wait(400)

  console.log('3. Voltar ao horário de sempre')
  await menu('Varal teste')
  await p.locator('.modal .btn', { hasText: 'Voltar para as 23:50' }).click(); await wait(1500)
  check(sql(`select count(*) from task_later where task_id='${T1}'`) === '0', '↩ Voltar apaga o "mais tarde"')
  check(!/mais tarde/.test(await row('Varal teste').first().locator('.tag-t').innerText().catch(() => '')), 'e a linha volta ao normal')

  console.log('4. Horário de costume no ⋯')
  await menu('Lixo teste')
  const hint = p.locator('.modal .why.usual')
  await hint.waitFor({ timeout: 5000 }).catch(() => {})
  check(/costuma fazer por volta das 08:00/.test(await hint.innerText().catch(() => '')), 'mostra "🕰 costuma às 08:00"')
  await p.locator('.modal').screenshot({ path: S + '/03-costume.png' })
  await hint.locator('button', { hasText: 'Fixar às 08:00' }).click(); await wait(1500)
  check(sql(`select scheduled_time::text from tasks where id='${T2}'`).slice(0, 5) === '08:00', '"Fixar" vira o horário da tarefa')
  await menu('Lixo teste')
  check(await p.locator('.modal .why.usual').count() === 0, 'com horário fixo, o aviso some')
  await p.keyboard.press('Escape'); await wait(300)
  await b.close()

  console.log('5. Telegram: ⏰ +1 h')
  sql(`insert into telegram_links (household_id, who, chat_id, linked_at, active, tasks, evening) values ('${H}','g',955,now(),true,true,true)`)
  await fetch(TG + '/__reset')
  await cron(`?now=${at(TODAY, '09:02')}`)
  const m = (await tgCalls()).filter(c => c.method === 'sendMessage' && c.body.chat_id === 955).find(c => c.body.text.startsWith('✅ Regar teste'))
  check(!!m && JSON.stringify(m.body.reply_markup || {}).includes('lt:' + T3), 'o lembrete traz ⏰ +1 h')
  await fetch(TG + '/__reset')
  await hook({ update_id: 5501, callback_query: { id: 'cq55', from: { id: 955 }, data: 'lt:' + T3, message: { message_id: 90, chat: { id: 955 }, text: '✅ Regar teste\nEstá na hora (09:00).' } } }); await wait(800)
  const ed = (await tgCalls()).find(c => c.method === 'editMessageText')
  const nowTg = sql(`select to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI')`), want = laterAt(nowTg, 60)
  if (want) {
    const got = sql(`select to_char(at, 'HH24:MI') from task_later where task_id='${T3}' and date='${TODAY}'`)
    check(got === want || got === laterAt(nowTg, 65), `grava +1 h (${got})`)
    check(ed && /⏰ Mais tarde · Regar teste: lembro de novo às/.test(ed.body.text), 'a mensagem mostra o novo horário')
    // na hora nova, lembra de novo (mesmo dia)
    await fetch(TG + '/__reset')
    await cron(`?now=${at(TODAY, got)}`)
    const m2 = (await tgCalls()).filter(c => c.method === 'sendMessage' && c.body.chat_id === 955).find(c => c.body.text.startsWith('✅ Regar teste'))
    check(!!m2 && /pediu para lembrar agora/.test(m2.body.text), 'na hora nova, lembra de novo')
  } else check(ed && /Já é tarde para hoje/.test(ed.body.text), 'perto da meia-noite: avisa que já é tarde')

  check(errs.length === 0, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''))
  console.log(fails ? `== r55: ${fails} FALHA(S)` : '== r55: TUDO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); console.log('== r55: ERRO'); process.exit(1) })
