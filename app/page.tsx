'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Step = 'email' | 'verify'

export default function LoginPage() {
  const [step, setStep]       = useState<Step>('email')
  const [email, setEmail]     = useState('')
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function sendCode() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })
    if (error) { setError(error.message); setLoading(false); return }
    setStep('verify')
    setLoading(false)
  }

  async function verifyCode() {
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.verifyOtp({
      email, token: code, type: 'email'
    })
    if (error || !data.session) {
      setError('Código inválido ou expirado. Tente novamente.')
      setLoading(false)
      return
    }

    const userId = data.session.user.id
    const { data: profile } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', userId)
      .single()

    if (!profile?.household_id) {
      const { data: hh } = await supabase
        .from('households')
        .insert({ name: 'Ninho' })
        .select()
        .single()

      await supabase.from('profiles').upsert({
        id: userId,
        household_id: hh!.id,
        name: email.split('@')[0],
        avatar_color: '#5dcaa5',
      })
    }

    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-xs">

        <div className="text-center mb-10">
          <div className="text-4xl font-light tracking-tight text-brand-text mb-1">Ninho</div>
          <div className="text-xs text-brand-subtle">sistema operacional da sua casa</div>
        </div>

        {step === 'email' && (
          <div className="animate-slide-up space-y-3">
            <div className="text-xs text-brand-subtle text-center mb-4">
              Digite o email para receber o código de acesso.
            </div>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendCode()}
              autoFocus
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-brand-text text-sm outline-none focus:border-brand-green transition-colors"
            />
            {error && <div className="text-red-400 text-xs text-center">{error}</div>}
            <button
              onClick={sendCode}
              disabled={!email || loading}
              className="w-full bg-brand-green text-brand-bg rounded-xl py-3 text-sm font-medium disabled:opacity-40 interactive"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="animate-slide-up space-y-3">
            <div className="text-xs text-brand-subtle text-center mb-4">
              Código enviado para <span className="text-brand-text">{email}</span>.<br/>
              Verifique sua caixa de entrada.
            </div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && code.length === 6 && verifyCode()}
              autoFocus
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-brand-text text-lg outline-none focus:border-brand-green transition-colors text-center tracking-[0.4em] font-mono"
            />
            {error && <div className="text-red-400 text-xs text-center">{error}</div>}
            <button
              onClick={verifyCode}
              disabled={code.length < 6 || loading}
              className="w-full bg-brand-green text-brand-bg rounded-xl py-3 text-sm font-medium disabled:opacity-40 interactive"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
            <button
              onClick={() => { setStep('email'); setCode(''); setError('') }}
              className="w-full text-brand-subtle text-xs py-2"
            >
              ← Usar outro email
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
