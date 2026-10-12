'use client'
// Ajustes › "Ligar o Sobrou!": passo a passo para o resumo do mês aparecer no Início.
// Gera o segredo aqui no aparelho (não vai para servidor nenhum), mostra onde colar cada
// coisa na Vercel e testa a ligação. Nada de chave aparece em tela depois de testar.
import { useState } from 'react'
import { brl } from '@/lib/sobrou'
import { checkSobrou, type SobrouCheck } from '@/components/SobrouCard'

const genSecret = () => {
  const b = new Uint8Array(30); crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...Array.from(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const origin = (u: string | null) => { try { return u ? new URL(u.trim()).origin : '' } catch { return '' } }

function Copy({ text, label }: { text: string, label: string }) {
  const [ok, setOk] = useState(false)
  return <button className="lnk-inline sg-copy" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) }).catch(() => {}) }} aria-label={`Copiar ${label}`}>{ok ? 'copiado ✓' : 'copiar'}</button>
}

export function SobrouGuide({ householdId, link }: { householdId: string, link: string | null }) {
  const [secret, setSecret] = useState(''), [url, setUrl] = useState(origin(link))
  const [test, setTest] = useState<SobrouCheck | { s: 'busy' } | null>(null)
  const apiUrl = origin(url)
  const Name = ({ n }: { n: string }) => <><code>{n}</code> <Copy text={n} label={n}/></>
  return (
    <section className="card sg" id="sobrou-guia" aria-labelledby="sg-t">
      <div className="slbl" id="sg-t">💰 Ligar o Sobrou! ao Ninho</div>
      <p className="row-s">Para o resumo do mês (sobra, contas a pagar e vencimentos) aparecer no Início. Leva uns 5 minutos, uma vez só. Só números saem do Sobrou; nenhuma compra ou cartão.</p>
      <ol className="sg-steps">
        <li><b>Gere um segredo</b> (fica só neste aparelho; não mande para ninguém):
          <div className="tk-add sg-row">
            <input className="fi mono" readOnly value={secret} placeholder="toque em Gerar" aria-label="Segredo gerado"/>
            {secret ? <Copy text={secret} label="o segredo"/> : <button className="btn btn-s" onClick={() => setSecret(genSecret())}>Gerar</button>}
          </div>
        </li>
        <li><b>Na Vercel do Sobrou</b> (projeto do Sobrou) › <i>Settings › Environment Variables</i> › <i>Add</i>:
          <ul><li>Nome: <Name n="NINHO_RESUMO_TOKEN"/></li><li>Valor: o segredo do passo 1</li><li>Ambientes: marque <b>Production</b> (e Preview, se quiser) › <i>Save</i></li></ul>
        </li>
        <li><b>Na Vercel do Ninho</b> (este app) › <i>Settings › Environment Variables</i>, adicione as duas:
          <ul>
            <li>Nome: <Name n="SOBROU_RESUMO_TOKEN"/> · Valor: o <b>mesmo</b> segredo</li>
            <li>Nome: <Name n="SOBROU_API_URL"/> · Valor: o endereço do Sobrou:
              <div className="tk-add sg-row"><input className="fi" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://seu-sobrou.vercel.app" aria-label="Endereço do Sobrou"/>{apiUrl && <Copy text={apiUrl} label="o endereço"/>}</div>
              {url && !apiUrl && <small className="al-warn">Cole o endereço completo, começando com https://</small>}
              {apiUrl && <small>Use exatamente: <code>{apiUrl}</code></small>}
            </li>
            <li>Ambientes: marque <b>Production</b> › <i>Save</i></li>
          </ul>
        </li>
        <li><b>Publique de novo os dois apps</b>: em cada projeto da Vercel, <i>Deployments</i> › <i>⋯</i> no deploy mais recente de Production › <i>Redeploy</i>. Variável nova só vale depois disso.</li>
        <li><b>Teste aqui:</b>
          <div className="md-acts"><button className="btn btn-p" disabled={test?.s === 'busy'} onClick={async () => { setTest({ s: 'busy' }); setTest(await checkSobrou(householdId)) }}>{test?.s === 'busy' ? 'Testando…' : 'Testar a ligação'}</button></div>
          {test && test.s !== 'busy' && <div className={`sg-res ${test.s === 'ok' ? 'ok' : 'bad'}`} role="status">
            {test.s === 'ok' && <>✓ <b>Ligado!</b> Sobra projetada do mês: <b>{brl(test.r.sobraProjetada)}</b>. O cartão já aparece no Início.</>}
            {test.s === 'off' && <>Ainda falta na Vercel do <b>Ninho</b>: {test.missing.map(m => <code key={m}>{m}</code>)}. Confira os passos 3 e 4 (marcou Production? fez o Redeploy?).</>}
            {test.s === 'err' && <>{test.msg} {/segredo/.test(test.msg) ? 'O segredo do passo 2 e o do passo 3 precisam ser iguais (refaça os dois com o mesmo valor e o Redeploy).' : /respondeu|demorou/.test(test.msg) ? 'Confira o endereço do passo 3 e se o Sobrou foi publicado de novo (passo 4).' : ''}</>}
          </div>}
        </li>
      </ol>
    </section>
  )
}
