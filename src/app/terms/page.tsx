import type { Metadata } from 'next'
import Link from 'next/link'
import { Bullets, LegalPage, Section } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Términos de uso · Omegus',
  description: 'Condiciones de uso de Omegus.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Términos de uso" updated="19 de noviembre de 2026">
      <Section title="Un proyecto personal">
        <p>
          Omegus es un <strong className="text-zinc-100">proyecto personal, privado y sin ánimo de lucro</strong>. El acceso es
          solo por invitación, para un grupo reducido de personas. No cobra nada ni se ofrece al público general.
        </p>
      </Section>

      <Section title="Se ofrece «tal cual»">
        <Bullets
          items={[
            'Omegus se ofrece tal cual, sin garantías comerciales: puede fallar, cambiar o dejar de estar disponible en cualquier momento.',
            'No es asesoramiento financiero, fiscal ni de inversión. Las cifras, gráficos y respuestas del asistente son orientativos; comprueba siempre los datos importantes con tu banco.',
            'Los movimientos importados del banco pueden contener errores o llegar con retraso. Los datos oficiales son siempre los de tu banco.',
          ]}
        />
      </Section>

      <Section title="Tu cuenta y tu responsabilidad">
        <Bullets
          items={[
            'Eres responsable del uso de tu cuenta y de mantener en secreto tu contraseña.',
            'Usa Omegus solo para tus propias finanzas y de forma lícita. No intentes acceder a datos de otras personas ni dañar el servicio.',
            'Al conectar tu banco autorizas, mediante Open Banking (PSD2) y con permiso de solo lectura, que Omegus consulte los movimientos de tus cuentas. Puedes retirar esa autorización cuando quieras.',
          ]}
        />
      </Section>

      <Section title="Dejar de usar el servicio">
        <p>
          Puedes dejar de usar Omegus y desconectar tu banco cuando quieras desde Ajustes. También puedes pedir que se borre
          tu cuenta y todos tus datos escribiendo a{' '}
          <a href="mailto:attarastudio@gmail.com" className="font-semibold text-violet-400 hover:text-violet-300">
            attarastudio@gmail.com
          </a>
          . El acceso de una persona puede retirarse si se hace un uso indebido de la app.
        </p>
      </Section>

      <Section title="Limitación de responsabilidad">
        <p>
          En la medida que permite la ley, Omegus y su autor no se hacen responsables de decisiones tomadas a partir de la
          información mostrada, ni de pérdidas derivadas de errores, interrupciones o indisponibilidad del servicio o de
          terceros (bancos, Enable Banking, proveedores de alojamiento o de IA).
        </p>
      </Section>

      <Section title="Privacidad y cambios">
        <p>
          El tratamiento de tus datos se explica en la{' '}
          <Link href="/privacy" className="font-semibold text-violet-400 hover:text-violet-300">
            política de privacidad
          </Link>
          . Estos términos pueden actualizarse; la fecha de arriba indica la última versión.
        </p>
      </Section>
    </LegalPage>
  )
}
