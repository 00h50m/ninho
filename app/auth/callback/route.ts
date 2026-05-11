import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    // O token é trocado no lado cliente via @supabase/supabase-js
    // Redireciona com o code para o cliente processar
    return NextResponse.redirect(`${origin}${next}?code=${code}`)
  }

  return NextResponse.redirect(`${origin}/login`)
}
