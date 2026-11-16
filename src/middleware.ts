import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getIsAdmin } from '@/lib/auth/admin'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ⚠️ IMPORTANTE: No añadir lógica entre createServerClient y getClaims.
  // getClaims() valida la firma del JWT en local (sin ida y vuelta a Supabase
  // en cada request) y refresca la sesión si el token ha caducado.
  const {
    data: claimsData,
  } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const hasSession = !!claims?.sub

  const { pathname } = request.nextUrl
  const isPublicRoute = pathname === '/login' || pathname === '/invitacion'

  // Sin sesión → bloquear y redirigir a /login
  if (!hasSession && !isPublicRoute) {
    // Las rutas /api devuelven 401 JSON (no una redirección HTML a /login)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Invitación sin terminar (invited_at presente, sin username en metadata):
  // cualquier otra ruta redirige a /invitacion. `invited_at` no viaja en el JWT,
  // así que solo se consulta a Auth (getUser) cuando el JWT no trae username:
  // usuarios con perfil completo no pagan esa llamada.
  if (hasSession && pathname !== '/invitacion' && !claims?.user_metadata?.username) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.invited_at && !user.user_metadata?.username) {
      const url = request.nextUrl.clone()
      url.pathname = '/invitacion'
      return NextResponse.redirect(url)
    }
  }

  // Con sesión en /login → redirigir al dashboard
  if (hasSession && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // /signup solo accesible por el admin (ya hay sesión garantizada arriba).
  // Consulta a profiles solo en esta ruta, para no añadirla en cada request.
  if (hasSession && claims?.sub && pathname.startsWith('/signup')) {
    const isAdmin = await getIsAdmin(supabase, claims.sub)
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Ejecutar en todas las rutas excepto assets estáticos
    '/((?!_next/static|_next/image|favicon\\.ico|icons|splash|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
