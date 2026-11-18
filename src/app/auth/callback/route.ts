import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Callback de los enlaces de Supabase (invitación, recuperación…).
// Admite ?code= (PKCE) y ?token_hash=&type= (plantilla de correo personalizada).
// Si el enlace usa flujo implícito (#access_token en el fragmento) el servidor
// no ve el fragmento: /set-password lo procesa en el navegador.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const target = request.nextUrl.clone()
  target.search = ''
  target.pathname = '/set-password'

  try {
    const supabase = await createClient()
    let ok = false

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      ok = !error
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      ok = !error
    } else {
      // Sin parámetros: puede traer el fragmento (se conserva en la redirección).
      return NextResponse.redirect(target)
    }

    if (!ok) {
      // /set-password mostrará AUTH-009 al no haber sesión
      return NextResponse.redirect(target)
    }

    // Recuperación de contraseña también pasa por /set-password; el resto, a la app
    if (type === 'invite' || type === 'recovery' || !type) {
      return NextResponse.redirect(target)
    }
    target.pathname = '/'
    return NextResponse.redirect(target)
  } catch {
    return NextResponse.redirect(target)
  }
}
