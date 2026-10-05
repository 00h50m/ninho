// Fase 6: mensagens de login e conta guardada no aparelho.
import { describe, expect, it } from 'vitest'
import { friendlyAuthError } from '@/lib/authErrors'
import { forgetMember, readMember, rememberMember } from '@/lib/member'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } } }

describe('login', () => {
  it('traduz os erros do Supabase', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('E-mail ou senha incorretos.')
    expect(friendlyAuthError('Email not confirmed')).toContain('Auto Confirm')
    expect(friendlyAuthError('Password should be at least 6 characters')).toContain('6 caracteres')
    expect(friendlyAuthError('Failed to fetch')).toContain('Sem conexão')
    expect(friendlyAuthError(undefined)).toContain('Tente de novo')
  })
  it('guarda a conta para abrir sem internet e apaga ao sair', () => {
    const s = mem()
    expect(readMember(s)).toBeNull()
    rememberMember({ householdId: 'h', who: 's', email: 'a@b', userId: 'u' }, s)
    expect(readMember(s)).toEqual({ householdId: 'h', who: 's', email: 'a@b', userId: 'u' })
    s.setItem('ninho.member', JSON.stringify({ householdId: 'h', who: 'x', userId: 'u' }))
    expect(readMember(s)).toBeNull()
    rememberMember({ householdId: 'h', who: 'g', email: '', userId: 'u' }, s)
    forgetMember(s)
    expect(readMember(s)).toBeNull()
  })
})
