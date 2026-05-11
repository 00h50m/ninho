import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppProvider } from '@/lib/AppContext'
import { Dashboard } from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  // verificar se tem perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', session.user.id)
    .single()

  if (!profile?.household_id) redirect('/login')

  return (
    <AppProvider userId={session.user.id}>
      <Dashboard />
    </AppProvider>
  )
}
