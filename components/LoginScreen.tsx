'use client'
// Entrada com e-mail e senha, e "Criar conta" (047): quem chega cria a conta aqui e, depois de
// entrar, cria a casa ou entra pelo convite (HouseSetupScreen). Com um convite aberto no aparelho
// (?convite=…), a tela mostra de quem é e já começa em "Criar conta". "Esqueci a senha" manda um
// link por e-mail; ao abrir o link, o app mostra a tela de nova senha (modo 'recovery').
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { friendlyAuthError } from '@/lib/authErrors'
import { clearPendingInvite, inviteCode, inviteLink, pendingInvite } from '@/lib/convite'
import * as conta from '@/lib/services/conta'

const CSS = `
.lg{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--bg);color:var(--tx);font-family:var(--font)}
.lg *{box-sizing:border-box}
.lg-box{width:100%;max-width:360px}
.lg-logo{font-family:var(--font-mono);font-size:30px;letter-spacing:-.02em;margin-bottom:6px}
.lg-logo span{color:var(--pri)}
.lg-sub{color:var(--sub);font-size:14px;margin-bottom:26px}
.lg-l{display:block;font-size:12px;font-weight:500;color:var(--mu);margin:14px 0 6px}
.lg-i{width:100%;padding:13px 14px;border-radius:10px;border:1px solid var(--bd2);background:var(--sf);box-shadow:var(--shadow-sm);color:var(--tx);font-size:16px;outline:none;font-family:inherit}
.lg-i:focus{border-color:var(--pri)}
.lg-b{width:100%;margin-top:20px;padding:13px;border:none;border-radius:10px;background:var(--pri);color:var(--on-pri);font-size:15px;font-weight:500;cursor:pointer;font-family:inherit}
.lg-b:disabled{opacity:.5;cursor:progress}
.lg-lnk{background:none;border:none;color:var(--pri);font-size:13px;margin-top:16px;cursor:pointer;padding:6px 0;font-family:inherit}
.lg-err{margin-top:14px;padding:11px 13px;border-radius:10px;background:var(--cbg);border:1px solid var(--cbdr);color:var(--cor-tx);font-size:13px}
.lg-ok{margin-top:14px;padding:11px 13px;border-radius:10px;background:var(--gbg);border:1px solid var(--gbdr);color:var(--green);font-size:13px}
.lg-pw{position:relative}.lg-pw .lg-i{padding-right:70px}
.lg-eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--sub);font-size:12px;cursor:pointer;padding:6px}
.lg-inv{margin:-10px 0 20px;padding:12px 14px;border-radius:12px;background:var(--pri-bg);border:1px solid var(--pri-bd);font-size:14px;line-height:1.45}
.lg-or{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:6px}
.lg-note{font-size:12px;color:var(--sub);margin-top:14px;line-height:1.5}
.lg-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--sf2);border-radius:12px;padding:4px;margin-bottom:6px}
.lg-tabs button{border:none;background:transparent;border-radius:9px;padding:10px 6px;font:inherit;font-size:14px;color:var(--sub);cursor:pointer}
.lg-tabs button.on{background:var(--sf);color:var(--tx);font-weight:500;box-shadow:var(--shadow-sm)}
`

export function LoginScreen({ mode = 'login', onDone }: { mode?: 'login' | 'recovery', onDone: () => void }) {
  const [view, setView] = useState<'login' | 'forgot' | 'recovery' | 'signup' | 'check'>(mode)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  // convite aberto neste aparelho: mostra de quem é e começa em "Criar conta"
  const [inv, setInv] = useState<{ house: string, from: string } | null>(null)
  useEffect(() => {
    const code = mode === 'login' ? pendingInvite() : null
    if (!code) return
    conta.inviteInfo(code).then(i => { if (i) { setInv(i); setView(v => v === 'login' ? 'signup' : v) } }).catch(() => {})
  }, [mode])
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  async function login(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    setBusy(false)
    if (error) setErr(friendlyAuthError(error.message)); else onDone()
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (pw.length < 8) { setErr('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (pw !== pw2) { setErr('As duas senhas não são iguais.'); return }
    setBusy(true); setErr('')
    try {
      const r = await conta.signUp(email, pw)
      if (r.session) onDone(); else setView('check')
    } catch (er: any) { setErr(friendlyAuthError(String(er?.message || er))) }
    finally { setBusy(false) }
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !email.trim()) return
    setBusy(true); setErr(''); setOk('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    setBusy(false)
    if (error) setErr(friendlyAuthError(error.message))
    else setOk('Se esse e-mail tiver conta, chega um link em instantes. Abra o link neste aparelho para criar a senha nova.')
  }

  async function newPassword(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (pw.length < 8) { setErr('A senha precisa ter pelo menos 8 caracteres.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setErr(friendlyAuthError(error.message)); else onDone()
  }

  const pwField = (label: string, auto: string) => <>
    <label className="lg-l" htmlFor="lg-pw">{label}</label>
    <div className="lg-pw">
      <input id="lg-pw" className="lg-i" type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete={auto} required minLength={6}/>
      <button type="button" className="lg-eye" onClick={() => setShow(v => !v)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'}>{show ? 'esconder' : 'mostrar'}</button>
    </div>
  </>

  return (
    <main className="lg">
      <style>{CSS}</style>
      <div className="lg-box">
        <div className="lg-logo">Ni<span>nho</span></div>
        {inv && (view === 'login' || view === 'signup') && <div className="lg-inv" role="status">📩 <b>{inv.from || 'Alguém'}</b> te convidou para a casa <b>{inv.house}</b>. {view === 'signup' ? 'Crie a sua conta para entrar.' : 'Entre com a sua conta para aceitar.'}</div>}
        {view === 'login' && <form onSubmit={login}>
          <div className="lg-sub">Entre com a sua conta.</div>
          <label className="lg-l" htmlFor="lg-email">E-mail</label>
          <input id="lg-email" className="lg-i" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" required autoFocus/>
          {pwField('Senha', 'current-password')}
          {err && <div className="lg-err" role="alert">{err}</div>}
          <button className="lg-b" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <div className="lg-or">
            <button type="button" className="lg-lnk" onClick={() => { setView('signup'); setErr('') }}>Criar conta</button>
            <span className="lg-lnk" aria-hidden="true" style={{ color: 'var(--faint)' }}>·</span>
            <button type="button" className="lg-lnk" onClick={() => { setView('forgot'); setErr('') }}>Esqueci a senha</button>
          </div>
        </form>}
        {view === 'signup' && <form onSubmit={signup}>
          <div className="lg-sub">{inv ? 'Crie a sua conta.' : 'Crie a sua conta. Depois você cria a sua casa (ou entra pelo convite de alguém).'}</div>
          <label className="lg-l" htmlFor="lg-email">E-mail</label>
          <input id="lg-email" className="lg-i" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" required autoFocus/>
          {pwField('Senha (mínimo 8 caracteres)', 'new-password')}
          <label className="lg-l" htmlFor="lg-pw2">Repita a senha</label>
          <input id="lg-pw2" className="lg-i" type={show ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" required minLength={8}/>
          {err && <div className="lg-err" role="alert">{err}</div>}
          <button className="lg-b" disabled={busy}>{busy ? 'Criando…' : 'Criar conta'}</button>
          <button type="button" className="lg-lnk" onClick={() => { setView('login'); setErr('') }}>Já tenho conta: entrar</button>
          <p className="lg-note">Os seus dados ficam só na sua casa. Ninguém de outra casa vê nada.</p>
        </form>}
        {view === 'check' && <div>
          <div className="lg-ok" role="status">Conta criada! Mandamos um e-mail para <b>{email.trim()}</b>. Abra o link de confirmação e depois volte aqui para entrar.</div>
          <button className="lg-b" onClick={() => { setView('login'); setPw(''); setPw2('') }}>Já confirmei: entrar</button>
        </div>}
        {view === 'forgot' && <form onSubmit={forgot}>
          <div className="lg-sub">Mandamos um link para criar uma senha nova.</div>
          <label className="lg-l" htmlFor="lg-email">E-mail</label>
          <input id="lg-email" className="lg-i" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" required autoFocus/>
          {err && <div className="lg-err" role="alert">{err}</div>}
          {ok && <div className="lg-ok" role="status">{ok}</div>}
          <button className="lg-b" disabled={busy}>{busy ? 'Enviando…' : 'Enviar link'}</button>
          <button type="button" className="lg-lnk" onClick={() => { setView('login'); setErr(''); setOk('') }}>← Voltar</button>
        </form>}
        {view === 'recovery' && <form onSubmit={newPassword}>
          <div className="lg-sub">Crie a sua senha nova.</div>
          {pwField('Senha nova (mínimo 8 caracteres)', 'new-password')}
          {err && <div className="lg-err" role="alert">{err}</div>}
          <button className="lg-b" disabled={busy}>{busy ? 'Salvando…' : 'Salvar e entrar'}</button>
        </form>}
      </div>
    </main>
  )
}

/**
 * Conta entrou e ainda não tem casa (047): cria a casa ("Criar minha casa") ou entra pelo
 * convite (o link que a outra pessoa mandou). O convite aberto neste aparelho já vem preenchido.
 */
export function NoHouseScreen({ email, onSignOut, onRetry }: { email: string, onSignOut: () => void, onRetry: () => void }) {
  const pending = pendingInvite()
  const [view, setView] = useState<'criar' | 'convite'>(pending ? 'convite' : 'criar')
  const [name, setName] = useState(''), [house, setHouse] = useState(''), [code, setCode] = useState(pending ? inviteLink(window.location.origin, pending) : '')
  const [inv, setInv] = useState<{ house: string, from: string } | null>(null)
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  useEffect(() => {
    const c = inviteCode(code)
    if (!c) { setInv(null); return }
    conta.inviteInfo(c).then(setInv).catch(() => setInv(null))
  }, [code])

  async function go(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!name.trim()) { setErr('Escreva o seu nome.'); return }
    setBusy(true); setErr('')
    try {
      if (view === 'criar') await conta.createHousehold(house.trim(), name.trim())
      else {
        const c = inviteCode(code)
        if (!c) { setErr('Cole o link do convite (ou o código).'); setBusy(false); return }
        await conta.acceptInvite(c, name.trim())
      }
      clearPendingInvite()
      onRetry()
    } catch (er: any) { setErr(er?.userMessage || 'Não foi possível agora. Tente de novo.'); setBusy(false) }
  }

  return (
    <main className="lg">
      <style>{CSS}</style>
      <div className="lg-box">
        <div className="lg-logo">Ni<span>nho</span></div>
        <div className="lg-sub" style={{ marginBottom: 16 }}>Bem-vinda(o)! A conta <b style={{ color: 'var(--tx)' }}>{email}</b> ainda não tem casa.</div>
        <div className="lg-tabs" role="tablist" aria-label="Como começar">
          <button role="tab" aria-selected={view === 'criar'} className={view === 'criar' ? 'on' : ''} onClick={() => { setView('criar'); setErr('') }}>Criar minha casa</button>
          <button role="tab" aria-selected={view === 'convite'} className={view === 'convite' ? 'on' : ''} onClick={() => { setView('convite'); setErr('') }}>Tenho um convite</button>
        </div>
        <form onSubmit={go}>
          <label className="lg-l" htmlFor="hs-name">Seu nome</label>
          <input id="hs-name" className="lg-i" value={name} maxLength={40} onChange={e => setName(e.target.value)} autoComplete="given-name" required autoFocus/>
          {view === 'criar' ? <>
            <label className="lg-l" htmlFor="hs-house">Nome da casa (opcional)</label>
            <input id="hs-house" className="lg-i" value={house} maxLength={40} onChange={e => setHouse(e.target.value)} placeholder="Ex.: Casa da Ana"/>
            <p className="lg-note">Você começa sozinha(o). Quando quiser, convide a segunda pessoa em Ajustes › Integrantes.</p>
          </> : <>
            <label className="lg-l" htmlFor="hs-code">Link do convite</label>
            <input id="hs-code" className="lg-i" value={code} onChange={e => setCode(e.target.value)} placeholder="Cole aqui o link que recebeu" autoComplete="off"/>
            {inv && <div className="lg-ok" role="status">📩 Convite de <b>{inv.from || 'alguém'}</b> para a casa <b>{inv.house}</b>.</div>}
            {inviteCode(code) && !inv && <p className="lg-note">Não achamos esse convite: ele pode ter vencido (vale 7 dias) ou já ter sido usado. Peça um novo.</p>}
          </>}
          {err && <div className="lg-err" role="alert">{err}</div>}
          <button className="lg-b" disabled={busy}>{busy ? 'Um instante…' : view === 'criar' ? 'Criar minha casa' : 'Entrar na casa'}</button>
        </form>
        <button className="lg-lnk" onClick={onSignOut}>Sair e entrar com outra conta</button>
      </div>
    </main>
  )
}
