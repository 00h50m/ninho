// C2: telas vazias com o Nino (casa sem nada cadastrado), no celular e no computador, com axe.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')
const { execSync } = require('child_process')
const fs = require('fs')
const S = (process.env.E2E_SHOTS || '/tmp/ninho-e2e/shots') + '/r53'; fs.rmSync(S, { recursive: true, force: true }); fs.mkdirSync(S, { recursive: true })
const APP = 'http://localhost:3124', H = '11111111-1111-1111-1111-111111111111'
const PSQL = 'runuser -u postgres -- /usr/lib/postgresql/16/bin/psql -X -h localhost -p 54330 -U postgres -d ninho'
const sql = q => execSync(`${PSQL} -At -c "${q.replace(/"/g, '\\"')}"`).toString().trim()
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [__dirname + '/..'] }), 'utf8')
let fails = 0
const check = (c, m) => { console.log((c ? '  ok - ' : '  FALHOU - ') + m); if (!c) fails++ }
const errs = [], wait = ms => new Promise(r => setTimeout(r, ms))
const casaSub = async (pg, t) => { const g = /Despensa|Jantar|^Lista$/.test(t) ? 'Compras' : /Manuten|Faxin|Sugest/.test(t) ? 'Mais' : /^Rotinas$/.test(t) ? 'Tarefas' : null
  if (g) { await pg.locator('.subtab', { hasText: g }).first().click(); await wait(350) }
  await ((await pg.locator('.casa-sub .fc', { hasText: t }).count()) ? pg.locator('.casa-sub .fc', { hasText: t }) : pg.locator('.subtab', { hasText: t })).first().click() }
;(async () => {
  sql(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c0c1','giovanna@ninho.test'),('00000000-0000-0000-0000-00000000c0c2','sabrina@ninho.test') on conflict do nothing`)
  sql(`select public.ninho_link_member('giovanna@ninho.test','g','${H}')`); sql(`select public.ninho_link_member('sabrina@ninho.test','s','${H}')`)
  execSync(`${PSQL} -q -v ON_ERROR_STOP=1 -f /tmp/ninho-sql-ro/migrations/20261011120100_rls_por_casa.sql 2>/dev/null`)
  sql(`insert into household_setup (household_id, completed_at, completed_by) values ('${H}', now(), 'g') on conflict do nothing`)
  // casa vazia: sem tarefas, cães, compras, agenda nem manutenção
  for (const t of ['task_completions', 'tasks', 'dog_routine_completions', 'dog_routines', 'dogs', 'shopping_items', 'agenda_events', 'maintenance_items']) {
    try { sql(`delete from ${t} where household_id='${H}'`) } catch { try { sql(`delete from ${t}`) } catch { /* tabela não existe */ } }
  }
  const b = require('../lib/mute-agua.js')(await chromium.launch())
  for (const [label, vp, mob] of [['cel', { width: 390, height: 844 }, true], ['pc', { width: 1280, height: 860 }, false]]) {
    console.log(`== ${label}`)
    const ctx = await b.newContext({ viewport: vp, isMobile: mob, hasTouch: mob, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' })
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept())
    const nav = t => p.locator(mob ? '.bnb' : '.snav-i', { hasText: t }).first().click()
    await p.goto(APP); await p.waitForSelector('#lg-email')
    await p.fill('#lg-email', 'giovanna@ninho.test'); await p.fill('#lg-pw', 'senha-gio-123'); await p.locator('.lg-b').click()
    await p.waitForSelector('.pcard', { timeout: 20000 }); await wait(1500)
    const telas = [['Casa', null, 'Nenhuma tarefa cadastrada'], ['Casa', 'Lista', 'Nada na lista'], ['Casa', 'Agenda', 'Nada marcado'], ['Casa', 'Manutenção', 'Nenhuma manutenção'], ['Cães', null, 'Nenhum pet']]
    for (const [aba, sub, txt] of telas) {
      await nav(aba); await wait(700)
      if (sub) { await casaSub(p, sub); await wait(800) }
      const box = p.locator('.empty', { hasText: txt }).first()
      await box.waitFor({ timeout: 6000 }).catch(() => {})
      const n = await box.locator('.empty-nino svg').count()
      check(n === 1, `${aba}${sub ? ' › ' + sub : ''}: o Nino aparece em "${txt}"`)
      check(await box.locator('.empty-nino').getAttribute('aria-hidden') === 'true', '  e fica escondido do leitor de tela (o texto diz tudo)')
      const r = await box.locator('.empty-nino').boundingBox().catch(() => null)
      const rb = await box.boundingBox().catch(() => null)
      check(!!r && !!rb && r.x >= rb.x && r.x + r.width <= rb.x + rb.width + 14, '  cabe dentro do cartão')
      await p.screenshot({ path: `${S}/${label}-${(sub || aba).toLowerCase().replace(/[^a-z]/g, '')}.png` })
    }
    // barra de baixo sem buraco (celular) e um logo só (computador)
    if (mob) {
      const g = await p.evaluate(() => { const n = document.querySelector('.bnav'); const bs = [...n.querySelectorAll('.bnb')]; const r = n.getBoundingClientRect(), last = bs[bs.length - 1].getBoundingClientRect(); return { n: bs.length, gap: Math.round(r.right - last.right) } })
      check(g.gap <= 12, `barra de baixo ocupa a largura toda (${g.n} abas, sobra ${g.gap}px à direita)`)
    } else {
      const logos = await p.evaluate(() => [...document.querySelectorAll('.logo, .snav-logo')].filter(e => e.offsetParent !== null).length)
      check(logos === 1, `um logo só no computador (${logos})`)
    }
    await p.addScriptTag({ content: AXE })
    const v = await p.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => `${v.id}(${v.nodes.length})`))
    check(v.length === 0, 'axe sem problemas na tela vazia' + (v.length ? ': ' + v.join(', ') : ''))
    await ctx.close()
  }
  check(errs.length === 0, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''))
  await b.close()
  console.log(fails ? `== r53: ${fails} FALHA(S)` : '== r53: TUDO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); console.log('== r53: ERRO'); process.exit(1) })
