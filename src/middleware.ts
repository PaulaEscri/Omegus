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

  // ⚠️ IMPORTANTE: No añadir lógica entre createServerClient y getUser.
  // getUser() valida el token contra Supabase en cada request (no confía en la cookie local).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicRoute = pathname === '/login' || pathname === '/invitacion'

  // Sin sesión → bloquear y redirigir a /login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Invitación sin terminar (invited_at presente, sin username en metadata):
  // cualquier otra ruta redirige a /invitacion. Solo datos de `user`, sin BD.
  if (user && pathname !== '/invitacion' && user.invited_at && !user.user_metadata?.username) {
    const url = request.nextUrl.clone()
    url.pathname = '/invitacion'
    return NextResponse.redirect(url)
  }

  // Con sesión en /login → redirigir al dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // /signup solo accesible por el admin (ya hay sesión garantizada arriba).
  // Consulta a profiles solo en esta ruta, para no añadirla en cada request.
  if (user && pathname.startsWith('/signup')) {
    const isAdmin = await getIsAdmin(supabase, user.id)
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
