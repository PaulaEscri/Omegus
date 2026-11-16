// Mismo criterio que next.config.ts: en producción la app vive bajo /omegus.
// fetch() desde el navegador NO añade el basePath solo, así que las llamadas a
// route handlers (/api/...) lo prefijan con esta constante.
export const BASE_PATH = process.env.NODE_ENV === 'production' ? '/omegus' : ''
