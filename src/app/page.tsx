import { redirect } from 'next/navigation'

// La página raíz redirige siempre al dashboard
export default function HomePage() {
  redirect('/dashboard')
}
