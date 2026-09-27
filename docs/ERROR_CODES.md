# Códigos de error

Códigos que la app muestra al usuario con el formato `Error AUTH-00X: <mensaje>` (p. ej. `Error AUTH-001: No se pudo conectar`). La definición en código vive en `src/lib/errors.ts`; si añades uno aquí, añádelo también allí.

## Autenticación (`AUTH`)

| Código   | Nombre                  | Mensaje en la UI                     | Cuándo ocurre |
|----------|-------------------------|---------------------------------------|---------------|
| AUTH-001 | Fetch failed            | No se pudo conectar                  | No se pudo contactar con Supabase (sin conexión, CORS, URL/keys mal configuradas) o cualquier excepción inesperada durante el login/registro. |
| AUTH-002 | Credenciales inválidas  | Email o contraseña incorrectos       | `signInWithPassword` devuelve error (email/usuario o contraseña incorrectos, email sin confirmar). |
| AUTH-003 | Error al crear cuenta   | No se pudo crear la cuenta           | `auth.admin.createUser` / `auth.updateUser` devuelve error (email ya registrado, contraseña débil, fallo del trigger que crea el perfil, etc.). |
| AUTH-004 | Falta nombre de usuario | Introduce un nombre de usuario       | Se intenta crear cuenta o completar una invitación sin rellenar "Nombre de usuario". Se valida en el cliente antes de llamar a la server action. |
| AUTH-005 | Sesión no válida        | Tu sesión no es válida, vuelve a intentarlo | `acceptInvitation` no encuentra usuario en el cliente de servidor (la sesión de la invitación no llegó o expiró). |
| AUTH-006 | Contraseñas distintas   | Las contraseñas no coinciden         | Validación en el cliente al crear cuenta o completar una invitación, antes de llamar a la server action. |
| AUTH-007 | Solo admin              | No tienes permiso para crear cuentas | `createUserAsAdmin` / `inviteUser` invocada por un usuario sin `profiles.is_admin`. |
| AUTH-008 | Usuario en uso          | Ese nombre de usuario ya existe      | El `username` normalizado (trim + minúsculas) ya existe en `profiles`. |
| AUTH-009 | Invitación no válida    | El enlace de invitación no es válido o ha caducado | `/invitacion` sin sesión válida (tras procesar el hash) o con `error`/`error_description` en el hash. |
| AUTH-010 | Email ya registrado     | Ya existe una cuenta con ese email   | `inviteUser` con un email que ya existe en `profiles`. |
| AUTH-011 | Error al invitar        | No se pudo enviar la invitación      | `inviteUserByEmail` devuelve error (límite de correos, SMTP, etc.). |

El detalle técnico de cada error se registra con `console.error` para depuración; la UI solo muestra el código y el mensaje de esta tabla.
