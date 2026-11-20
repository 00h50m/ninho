// D2: modo foco no Início (só o que é meu agora, com ✓ grande) e histórico visual em Nós
// (mapa de calor do mês por pessoa e sequências das tarefas), no celular e no computador, com axe.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')
const { execSync } = require('child_process')
const fs = require('fs')
const S = (process.env.E2E_SHOTS || '/tmp/ninho-e2e/shots') + '/r56'; fs.rmSync(S, { recursive: true, force: true }); fs.mkdirSync(S, { recursive: true })
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [__dirname + '/..'] }), 'utf8')
const APP = 'http://localhost:3124', H = '11111111-1111-1111-1111-111111111111'
const PSQL = 'runuser -u postgres -- /usr/lib/postgresql/16/bin/psql -X -h localhost -p 54330 -U postgres -d ninho'
const sql = q => execSync(`${PSQL} -At -c "${q.replace(/"/g, '\\"')}"`).toString().trim()
let fails = 0
const check = (c, m) => { console.log((c ? '  ok - ' : '  FALHOU - ') + m); if (!c) fails++ }
const errs = [], wait = ms => new Promise(r => setTimeout(r, ms))
const axe = async (p, sel) => { await p.addScriptTag({ content: AXE }); return p.evaluate(async s => (await window.axe.run(document.querySelector(s), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => `${v.id}(${v.nodes.length})`), sel) }
;(async () => {
  sql(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c0c1','giovanna@ninho.test'),('00000000-0000-0000-0000-00000000c0c2','sabrina@ninho.test') on conflict do nothing`)
  sql(`select public.ninho_link_member('giovanna@ninho.test','g','${H}')`); sql(`select public.ninho_link_member('sabrina@ninho.test','s','${H}')`)
  execSync(`${PSQL} -q -v ON_ERROR_STOP=1 -f /tmp/ninho-sql-ro/migrations/20261011120100_rls_por_casa.sql 2>/dev/null`)
  sql(`insert into household_setup (household_id, completed_at, completed_by) values ('${H}', now(), 'g') on conflict do nothing`)
  const TODAY = sql(`select public.ninho_today()`), day = n => sql(`select ('${TODAY}'::date - ${n})::text`)
  // atrasada: 1 h atrás (sem virar o dia); essencial sem horário; regar feito 8 dias seguidos
  const past = sql(`select to_char(greatest(date_trunc('day', now() at time zone 'America/Sao_Paulo'), (now() at time zone 'America/Sao_Paulo') - interval '1 hour'), 'HH24:MI')`)
  const F1 = '56565656-0000-0000-0000-000000000001', F2 = '56565656-0000-0000-0000-000000000002', F3 = '56565656-0000-0000-0000-000000000003'
  sql(`insert into tasks (id, household_id, title, category, frequency, assigned_to, scheduled_time, essential, created_at) values
    ('${F1}','${H}','Atrasada foco','general','daily','g','${past}',false, now() - interval '40 days'),
    ('${F2}','${H}','Essencial foco','general','daily','g',null,true, now() - interval '40 days'),
    ('${F3}','${H}','Regar sequência','general','daily','s',null,false, now() - interval '40 days')`)
  for (let n = 1; n <= 8; n++) sql(`insert into task_completions (task_id, household_id, completed_by, date) values ('${F3}','${H}','s','${day(n)}')`)

  const b = require('../lib/mute-agua.js')(await chromium.launch())
  for (const [label, vp, mob] of [['cel', { width: 390, height: 844 }, true], ['pc', { width: 1280, height: 860 }, false]]) {
    console.log(`== ${label}`)
    const ctx = await b.newContext({ viewport: vp, isMobile: mob, hasTouch: mob, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' })
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept())
    await p.goto(APP); await p.waitForSelector('#lg-email')
    await p.fill('#lg-email', 'giovanna@ninho.test'); await p.fill('#lg-pw', 'senha-gio-123'); await p.locator('.lg-b').click()
    await p.waitForSelector('.pcard:not([data-hide="1"])'); await wait(1500)

    console.log('1. Modo foco')
    await p.locator('.foco-b').click(); await wait(700)
    const sheet = p.locator('.modal', { hasText: 'Foco' })
    const titles = await sheet.locator('.foco-t b').allInnerTexts()
    // no computador a atrasada já foi concluída (no celular, logo abaixo): a essencial vem primeiro
    // as atrasadas vêm antes das essenciais (o banco de teste tem outras, como a ração dos cães)
    const iA = titles.indexOf('Atrasada foco'), iE = titles.indexOf('Essencial foco')
    check(label === 'cel' ? iA >= 0 && iE > iA : iA < 0 && iE >= 0,
      (label === 'cel' ? 'atrasada antes da essencial: ' : 'feita no celular não aparece; a essencial sim: ') + titles.join(' · '))
    check(!titles.includes('Regar sequência'), 'não mostra o que é da outra')
    check(label === 'pc' || /⚠ atrasada/.test(await sheet.locator('.foco-i', { hasText: 'Atrasada foco' }).innerText()), 'diz por que está ali')
    const box = await sheet.locator('.foco-chk').first().boundingBox()
    check(box && box.width >= 44 && box.height >= 44, `✓ grande (${box && Math.round(box.width)}px)`)
    const v1 = await axe(p, '.modal'); check(v1.length === 0, 'axe sem problemas no foco' + (v1.length ? ': ' + v1.join(', ') : ''))
    await p.screenshot({ path: `${S}/${label}-01-foco.png` })
    if (label === 'cel') {
      await sheet.locator('.foco-i', { hasText: 'Atrasada foco' }).locator('.foco-chk').click(); await wait(1500)
      check(sql(`select completed_by from task_completions where task_id='${F1}' and date='${TODAY}'`) === 'g', '✓ conclui ali mesmo, como Giovanna')
      check(!(await sheet.locator('.foco-t b').allInnerTexts()).includes('Atrasada foco'), 'e sai da lista do foco')
    }
    await sheet.locator('.btn', { hasText: 'Sair do foco' }).click(); await wait(500)
    check(await p.locator('.modal', { hasText: 'Foco' }).count() === 0, '"Sair do foco" volta ao Início')

    console.log('2. Histórico visual')
    await p.locator(mob ? '.bnb' : '.snav-i', { hasText: 'Nós' }).first().click(); await wait(800)
    await p.locator('.subtab', { hasText: 'Histórico' }).first().click(); await wait(1200)
    const heat = p.locator('.heat-card')
    check(await heat.count() === 1 && await heat.locator('.heat').count() === 2, 'mapa do mês: um quadro para cada uma')
    const bx = await p.evaluate(() => ['.heat-p-g .heat-g', '.heat-p-s .heat-g'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }))
    const apart = bx[0].x + bx[0].w <= bx[1].x + 1 || bx[0].y + bx[0].h <= bx[1].y + 1
    check(apart && bx.every(b => b.w >= 150), `os dois quadros lado a lado ou um embaixo do outro, sem sobrepor (${bx.map(b => Math.round(b.w)).join(' e ')}px)`)
    check(await heat.locator('.heat-p-s .heat-c.l4, .heat-p-s .heat-c.l3, .heat-p-s .heat-c.l2, .heat-p-s .heat-c.l1').count() >= 8, 'os 8 dias da Sabrina aparecem coloridos')
    const cell = heat.locator('.heat-p-s .heat-c:not(.l0):not(.lf)').first()
    await cell.click(); await wait(300)
    check(/· Sabrina 1/.test(await heat.locator('.heat-read').innerText()), 'tocar num dia mostra o número em texto: ' + await heat.locator('.heat-read').innerText())
    await heat.locator('.heat-tab summary').click(); await wait(300)
    check(await heat.locator('.heat-tab tbody tr').count() === 5, 'tabela com as 5 semanas')
    const st = p.locator('section', { hasText: 'Sequências das tarefas' })
    check(/Regar sequência\s*8\s*dias seguidos/.test((await st.innerText()).replace(/\s+/g, ' ')), 'sequência: Regar 8 dias seguidos')
    check(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), 'sem rolagem lateral')
    const v2 = await axe(p, 'main'); check(v2.length === 0, 'axe sem problemas no Histórico' + (v2.length ? ': ' + v2.join(', ') : ''))
    await heat.screenshot({ path: `${S}/${label}-02-mapa.png` })
    await st.screenshot({ path: `${S}/${label}-03-sequencias.png` })
    await ctx.close()
  }
  check(errs.length === 0, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''))
  await b.close()
  console.log(fails ? `== r56: ${fails} FALHA(S)` : '== r56: TUDO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); console.log('== r56: ERRO'); process.exit(1) })
