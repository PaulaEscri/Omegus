import { redirect } from 'next/navigation'

// Ruta antigua: los correos ya enviados apuntan aquí. El fragmento (#access_token…)
// sobrevive a la redirección y lo procesa /set-password en el navegador.
export default function InvitacionPage() {
  redirect('/set-password')
}
