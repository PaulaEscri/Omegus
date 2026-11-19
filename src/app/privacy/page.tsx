import type { Metadata } from 'next'
import { Bullets, LegalPage, Section } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Política de privacidad · Omegus',
  description: 'Cómo trata Omegus tus datos personales y bancarios.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updated="19 de noviembre de 2026">
      <Section title="Qué es Omegus">
        <p>
          Omegus es un <strong className="text-zinc-100">proyecto personal y privado, sin ánimo de lucro</strong>, creado
          únicamente para llevar el control de los gastos personales de un grupo reducido de personas invitadas. No es un
          servicio comercial, no se ofrece al público y no tiene publicidad.
        </p>
      </Section>

      <Section title="Qué datos se guardan">
        <Bullets
          items={[
            'Tu cuenta: email y nombre de usuario.',
            'Lo que registras: movimientos, categorías, cuentas, presupuestos y lugares.',
            'Si conectas tu banco: el nombre del banco, un identificador de la cuenta, el IBAN solo de forma enmascarada (los 4 últimos dígitos) y los movimientos que autorizas, es decir, fecha, importe y comercio o concepto.',
            'Datos técnicos mínimos del servidor (registros de errores) para que la app funcione.',
          ]}
        />
      </Section>

      <Section title="Cero venta de datos">
        <p>
          <strong className="text-zinc-100">No vendemos, cedemos ni compartimos tus datos con terceros</strong> con fines
          comerciales. No hay publicidad, ni perfilado comercial, ni herramientas de analítica o seguimiento de terceros.
          Solo se usan cookies técnicas necesarias para mantener tu sesión iniciada.
        </p>
      </Section>

      <Section title="Conexión bancaria (Open Banking)">
        <Bullets
          items={[
            <>
              La conexión se hace únicamente mediante <strong className="text-zinc-100">Open Banking regulado (PSD2)</strong> a través
              de Enable Banking, con permiso de <strong className="text-zinc-100">solo lectura</strong>.
            </>,
            <>
              Autorizas el acceso en la página de tu propio banco.{' '}
              <strong className="text-zinc-100">
                Omegus nunca recibe ni almacena contraseñas bancarias, claves de acceso ni datos privados de inicio de sesión
              </strong>
              .
            </>,
            'Omegus no puede mover dinero, hacer pagos ni modificar nada en tu banco: solo consulta los movimientos que has autorizado para mostrártelos en tu propia app.',
            'La autorización dura como máximo 90 días. Pasado ese plazo debes renovarla; la app te avisa antes de que caduque.',
          ]}
        />
      </Section>

      <Section title="Quién interviene en el tratamiento">
        <p>
          Para funcionar, Omegus usa proveedores técnicos que tratan los datos únicamente por cuenta del proyecto y para este
          fin:
        </p>
        <Bullets
          items={[
            'Supabase: base de datos y autenticación.',
            'Cloudflare: alojamiento de la aplicación.',
            'Enable Banking: conexión PSD2 con tu banco (solo si decides conectarlo).',
            'Proveedor de IA (actualmente Google Gemini): solo si usas el asistente. Tu mensaje y los datos mínimos necesarios para responder se envían al modelo; no se usan para publicidad.',
          ]}
        />
      </Section>

      <Section title="Control y borrado">
        <Bullets
          items={[
            'Puedes desconectar tu banco en cualquier momento desde Ajustes → Bancos conectados. Al hacerlo se revoca el acceso en el banco y se borra la conexión.',
            'Puedes borrar tus movimientos desde la propia app.',
            'Puedes pedir la eliminación total de tu cuenta y de todos tus datos escribiendo al correo de contacto. Se elimina todo, incluidos los movimientos importados.',
            'También puedes pedir acceso, rectificación o una copia de tus datos. Si crees que no los tratamos bien, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).',
          ]}
        />
      </Section>

      <Section title="Conservación y seguridad">
        <p>
          Tus datos se conservan mientras mantengas tu cuenta. Cada usuario solo puede ver sus propios datos y la conexión
          con la app va cifrada (HTTPS). Los datos de acceso a Enable Banking viven solo en el servidor, nunca en tu
          navegador.
        </p>
      </Section>

      <Section title="Contacto">
        <p>
          Para cualquier duda o solicitud sobre privacidad:{' '}
          <a href="mailto:attarastudio@gmail.com" className="font-semibold text-violet-400 hover:text-violet-300">
            attarastudio@gmail.com
          </a>
          .
        </p>
      </Section>

      <Section title="Cambios">
        <p>
          Si esta política cambia de forma relevante, se actualizará esta página y la fecha de arriba. Al ser un grupo
          reducido, también se avisará directamente.
        </p>
      </Section>
    </LegalPage>
  )
}
