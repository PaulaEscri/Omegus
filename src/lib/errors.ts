// ============================================================
// Códigos de error — ver docs/ERROR_CODES.md para la tabla completa.
// Formato mostrado al usuario: "Error AUTH-00X: <mensaje>".
// Si añades un código aquí, añádelo también a esa tabla (y viceversa).
// ============================================================

export type ErrorCode =
  | 'AUTH-001' // Fetch failed — no se pudo contactar con Supabase, o excepción inesperada en login/registro
  | 'AUTH-002' // Credenciales inválidas — signInWithPassword devuelve error
  | 'AUTH-003' // Error al crear cuenta — signUp/auth.admin.createUser/updateUser devuelve error
  | 'AUTH-004' // Falta nombre de usuario — validación de cliente antes de crear cuenta
  | 'AUTH-012' // Contraseña débil — la contraseña no cumple los requisitos mínimos (mín. 6 caracteres)
  | 'AUTH-005' // Sesión no válida — acceptInvitation no encuentra usuario en el cliente de servidor
  | 'AUTH-006' // Contraseñas distintas — validación de cliente al crear cuenta
  | 'AUTH-007' // Solo admin — createUserAsAdmin/inviteUser invocada por alguien sin profiles.is_admin
  | 'AUTH-008' // Usuario en uso — el username normalizado ya existe en profiles
  | 'AUTH-009' // Invitación no válida — /set-password sin sesión válida o con error en el hash
  | 'AUTH-010' // Email ya registrado — inviteUser con un email que ya existe en profiles
  | 'AUTH-014' // Usuario no encontrado — el id objetivo del panel de admin no existe en profiles
  | 'AUTH-015' // Acción sobre uno mismo — el admin intenta eliminarse o quitarse el rol de admin
  | 'AUTH-016' // Email no válido — formato de email incorrecto en el panel de admin
  | 'AUTH-017' // Error al eliminar — auth.admin.deleteUser (o la limpieza de datos) falla
  | 'AUTH-018' // Error al actualizar — auth.admin.updateUserById o profiles devuelve error
  | 'AUTH-013' // Demasiados intentos — límite de intentos fallidos de login superado

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  'AUTH-001': 'No se pudo conectar',
  'AUTH-002': 'Email o contraseña incorrectos',
  'AUTH-003': 'No se pudo crear la cuenta',
  'AUTH-004': 'Introduce un nombre de usuario',
  'AUTH-012': 'La contraseña debe tener al menos 6 caracteres',
  'AUTH-005': 'Tu sesión no es válida, vuelve a intentarlo',
  'AUTH-006': 'Las contraseñas no coinciden',
  'AUTH-007': 'No tienes permiso para crear cuentas',
  'AUTH-008': 'Ese nombre de usuario ya existe',
  'AUTH-009': 'El enlace de invitación no es válido o ha caducado',
  'AUTH-010': 'Ya existe una cuenta con ese email',
  'AUTH-014': 'El usuario no existe',
  'AUTH-015': 'No puedes eliminar tu propia cuenta ni quitarte el rol de admin',
  'AUTH-016': 'Introduce un email válido',
  'AUTH-017': 'No se pudo eliminar el usuario',
  'AUTH-018': 'No se pudo actualizar el usuario',
  'AUTH-013': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo',
}

export function formatError(code: ErrorCode): string {
  return `Error ${code}: ${ERROR_MESSAGES[code]}`
}

// Registra el detalle técnico (para depuración) y devuelve el texto que ve
// el usuario. La UI nunca debe mostrar `detail` directamente.
export function reportError(code: ErrorCode, detail?: unknown): string {
  if (detail !== undefined) {
    console.error(`[${code}]`, detail)
  }
  return formatError(code)
}
