'use client'
// Entrada com e-mail e senha. As contas são criadas no painel do Supabase
// (não há cadastro pelo app). "Esqueci a senha" manda um link por e-mail;
// ao abrir o link, o app mostra a tela de nova senha (modo 'recovery').
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { friendlyAuthError } from '@/lib/authErrors'

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
`

export function LoginScreen({ mode = 'login', onDone }: { mode?: 'login' | 'recovery', onDone: () => void }) {
  const [view, setView] = useState<'login' | 'forgot' | 'recovery'>(mode)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
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
    if (pw.length < 6) { setErr('A senha precisa ter pelo menos 6 caracteres.'); return }
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
        {view === 'login' && <form onSubmit={login}>
          <div className="lg-sub">Entre com a sua conta.</div>
          <label className="lg-l" htmlFor="lg-email">E-mail</label>
          <input id="lg-email" className="lg-i" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" required autoFocus/>
          {pwField('Senha', 'current-password')}
          {err && <div className="lg-err" role="alert">{err}</div>}
          <button className="lg-b" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <button type="button" className="lg-lnk" onClick={() => { setView('forgot'); setErr('') }}>Esqueci a senha</button>
        </form>}
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
          {pwField('Senha nova (mínimo 6 caracteres)', 'new-password')}
          {err && <div className="lg-err" role="alert">{err}</div>}
          <button className="lg-b" disabled={busy}>{busy ? 'Salvando…' : 'Salvar e entrar'}</button>
        </form>}
      </div>
    </main>
  )
}

/** Conta entrou, mas ainda não foi ligada a uma casa (ninho_link_member). */
export function NoHouseScreen({ email, onSignOut, onRetry }: { email: string, onSignOut: () => void, onRetry: () => void }) {
  return (
    <main className="lg">
      <style>{CSS}</style>
      <div className="lg-box">
        <div className="lg-logo">Ni<span>nho</span></div>
        <div className="lg-sub" style={{ marginBottom: 14 }}>A conta <b style={{ color: 'var(--tx)' }}>{email}</b> ainda não está ligada à casa.</div>
        <div style={{ fontSize: 13.5, color: 'var(--mu)', lineHeight: 1.55 }}>
          No Supabase › SQL Editor, rode:<br/>
          <code style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--green)', wordBreak: 'break-all' }}>select public.ninho_link_member(&apos;{email}&apos;, &apos;g&apos;);</code><br/>
          (use <b>&apos;g&apos;</b> para Giovanna ou <b>&apos;s&apos;</b> para Sabrina) e toque em “Tentar de novo”.
        </div>
        <button className="lg-b" onClick={onRetry}>Tentar de novo</button>
        <button className="lg-lnk" onClick={onSignOut}>Sair e entrar com outra conta</button>
      </div>
    </main>
  )
}
