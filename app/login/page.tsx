'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Step = 'email' | 'verify' | 'setup'

export default function LoginPage() {
  const [step, setStep]   = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [name, setName]   = useState('')
  const [code, setCode]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [isJoining, setIsJoining] = useState(false)

  async function sendMagicLink() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })
    if (error) { setError(error.message); setLoading(false); return }
    setStep('verify')
    setLoading(false)
  }

  async function verifyOTP() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (error) { setError('Código inválido. Tente novamente.'); setLoading(false); return }
    setStep('setup')
    setLoading(false)
  }

  async function setupProfile() {
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sessão expirada.'); setLoading(false); return }

    if (isJoining && code.length === 8) {
      // entrar em household existente via código de convite
      const { data: hh } = await supabase
        .from('households')
        .select('id')
        .eq('invite_code', code.toLowerCase())
        .single()
      if (!hh) { setError('Código de convite inválido.'); setLoading(false); return }
      await supabase.from('profiles').upsert({
        id: user.id,
        household_id: hh.id,
        name,
        avatar_color: '#9f8fee',
      })
    } else {
      // criar novo household
      const { data: hh } = await supabase
        .from('households')
        .insert({ name: 'Ninho' })
        .select()
        .single()
      await supabase.from('profiles').upsert({
        id: user.id,
        household_id: hh!.id,
        name,
        avatar_color: '#5dcaa5',
      })
    }
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-4xl font-light tracking-tight text-brand-text mb-1">Ninho</div>
          <div className="text-sm text-brand-subtle">sistema operacional da sua casa</div>
        </div>

        {/* Step: email */}
        {step === 'email' && (
          <div className="animate-slide-up">
            <div className="text-sm text-brand-muted mb-6 text-center">
              Vamos criar seu acesso. Só precisamos do seu email — sem senha.
            </div>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMagicLink()}
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-brand-text text-sm mb-3 outline-none focus:border-brand-green transition-colors"
            />
            {error && <div className="text-red-400 text-xs mb-3">{error}</div>}
            <button
              onClick={sendMagicLink}
              disabled={!email || loading}
              className="w-full bg-brand-green text-brand-bg rounded-xl py-3 text-sm font-medium disabled:opacity-40 interactive"
            >
              {loading ? 'Enviando...' : 'Enviar código por email'}
            </button>
          </div>
        )}

        {/* Step: verify */}
        {step === 'verify' && (
          <div className="animate-slide-up">
            <div className="text-sm text-brand-muted mb-2 text-center">
              Código enviado para <span className="text-brand-text">{email}</span>
            </div>
            <div className="text-xs text-brand-subtle mb-6 text-center">
              Verifique sua caixa de entrada (e o spam)
            </div>
            <input
              type="text"
              placeholder="Cole o código de 6 dígitos"
              value={code}
              onChange={e => setCode(e.target.value)}
              maxLength={6}
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-brand-text text-sm mb-3 outline-none focus:border-brand-green transition-colors text-center text-lg tracking-widest"
            />
            {error && <div className="text-red-400 text-xs mb-3 text-center">{error}</div>}
            <button
              onClick={verifyOTP}
              disabled={code.length < 6 || loading}
              className="w-full bg-brand-green text-brand-bg rounded-xl py-3 text-sm font-medium disabled:opacity-40 interactive mb-3"
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
            <button onClick={() => setStep('email')} className="w-full text-brand-subtle text-xs py-2">
              ← Voltar
            </button>
          </div>
        )}

        {/* Step: setup */}
        {step === 'setup' && (
          <div className="animate-slide-up">
            <div className="text-sm text-brand-muted mb-6 text-center">
              Quase pronto. Como quer se chamar no Ninho?
            </div>
            <input
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-brand-text text-sm mb-4 outline-none focus:border-brand-green transition-colors"
            />

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setIsJoining(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${!isJoining ? 'bg-brand-green text-brand-bg border-brand-green' : 'bg-transparent text-brand-subtle border-brand-border'}`}
              >
                Criar nova casa
              </button>
              <button
                onClick={() => setIsJoining(true)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${isJoining ? 'bg-brand-purple text-brand-bg border-brand-purple' : 'bg-transparent text-brand-subtle border-brand-border'}`}
              >
                Entrar em casa existente
              </button>
            </div>

            {isJoining && (
              <input
                type="text"
                placeholder="Código de convite (8 caracteres)"
                value={code}
                onChange={e => setCode(e.target.value)}
                maxLength={8}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-brand-text text-sm mb-4 outline-none focus:border-brand-purple transition-colors"
              />
            )}

            {error && <div className="text-red-400 text-xs mb-3 text-center">{error}</div>}
            <button
              onClick={setupProfile}
              disabled={!name || loading || (isJoining && code.length < 8)}
              className="w-full bg-brand-green text-brand-bg rounded-xl py-3 text-sm font-medium disabled:opacity-40 interactive"
            >
              {loading ? 'Criando...' : 'Entrar no Ninho'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
