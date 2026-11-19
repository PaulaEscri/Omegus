// Limpieza del nombre del comercio y categoría básica por palabras clave.
// Funciones puras (sin acceso a red ni a BD).

export interface CategoryLite {
  id: string
  name: string
  parent_id: string | null
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const PREFIXES =
  /^(compra\s+(con\s+)?(tarjeta|tarj\.?)?\s*(en\s+)?|compra\s+en\s+|pago\s+(con\s+)?(tarjeta|tarj\.?)\s*(en\s+)?|pago\s+movil\s*(en\s+)?|pago\s+en\s+|adeudo\s+|recibo\s+|cargo\s+)/i

export function cleanMerchant(raw: string | null | undefined): string {
  let s = (raw ?? '').replace(/\s+/g, ' ').trim()
  s = s.replace(PREFIXES, '')
  s = s.replace(/\b(tarjeta|tarj\.?)\s*[*x\d\s-]{4,}/gi, ' ') // "TARJETA ****1234"
  s = s.replace(/\b\d{4}[*x]{3,}\d{2,4}\b/gi, ' ').replace(/[*x]{4,}\d{2,4}\b/gi, ' ') // 5540*****1234
  s = s.replace(/\*+/g, ' ').replace(/\b\d{5,}\b/g, ' ').replace(/[-_/]{2,}/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()

  // Si viene todo en mayúsculas o todo en minúsculas, pasa a "Título"
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '')
  if (letters.length > 3 && (letters === letters.toUpperCase() || letters === letters.toLowerCase())) {
    s = s.toLowerCase().replace(/(^|[\s&'-])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase())
  }
  return s.slice(0, 60).trim()
}

// Cada regla: palabras clave → nombres de categoría candidatos (de más a menos específico)
const RULES: { keywords: string[]; categories: string[] }[] = [
  {
    keywords: ['mercadona', 'carrefour', 'lidl', 'aldi', 'dia', 'alcampo', 'eroski', 'consum', 'supercor', 'hipercor', 'caprabo', 'ahorramas', 'bonpreu', 'condis', 'supermercado'],
    categories: ['supermercado', 'comida'],
  },
  {
    keywords: ['restaurante', 'mcdonald', 'burger king', 'telepizza', 'domino', 'glovo', 'uber eats', 'just eat', 'kfc', 'starbucks', 'cafeteria', 'pizzeria', 'sushi', 'taberna', 'cerveceria', 'bar', 'cafe'],
    categories: ['restaurantes', 'comida'],
  },
  {
    keywords: ['renfe', 'metro', 'emt', 'uber', 'cabify', 'bolt', 'repsol', 'cepsa', 'bp', 'shell', 'gasolinera', 'galp', 'parking', 'aparcamiento', 'peaje', 'taxi', 'ryanair', 'vueling', 'iberia', 'blablacar', 'alsa'],
    categories: ['transporte'],
  },
  {
    keywords: ['netflix', 'spotify', 'hbo', 'disney', 'prime video', 'amazon prime', 'youtube', 'icloud', 'google one', 'openai', 'chatgpt', 'patreon', 'dazn', 'movistar', 'vodafone', 'orange', 'digi', 'apple com bill'],
    categories: ['suscripciones'],
  },
  {
    keywords: ['cine', 'cinesa', 'yelmo', 'steam', 'playstation', 'nintendo', 'xbox', 'ticketmaster', 'entradas', 'gimnasio', 'gym', 'fever', 'teatro', 'discoteca'],
    categories: ['ocio y vida', 'ocio'],
  },
]

const FALLBACK = ['otros gastos', 'otros']

// Palabras cortas (dia, bar, bp…): coincidencia exacta. Marcas largas: por prefijo
// (mcdonald → "mcdonalds"; netflix → "netflix.com").
function keywordRegex(k: string): RegExp {
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(k.length >= 5 ? `(^|[^a-z0-9])${esc}` : `(^|[^a-z0-9])${esc}([^a-z0-9]|$)`)
}
const COMPILED = RULES.map((r) => ({ ...r, regexes: r.keywords.map(keywordRegex) }))

function findCategory(cats: CategoryLite[], candidates: string[]): CategoryLite | null {
  for (const cand of candidates) {
    const exact = cats.find((c) => norm(c.name) === cand)
    if (exact) return exact
  }
  for (const cand of candidates) {
    const partial = cats.find((c) => norm(c.name).includes(cand))
    if (partial) return partial
  }
  return null
}

// Devuelve { category_id, subcategory_id } según el modelo de la app
// (category_id = raíz, subcategory_id = hija). Sin coincidencia → ambos null.
export function categorize(
  text: string,
  expenseCategories: CategoryLite[]
): { category_id: string | null; subcategory_id: string | null } {
  const t = norm(text)
  let found: CategoryLite | null = null

  for (const rule of COMPILED) {
    if (rule.regexes.some((r) => r.test(t))) {
      found = findCategory(expenseCategories, rule.categories)
      if (found) break
    }
  }
  if (!found) found = findCategory(expenseCategories, FALLBACK)
  if (!found) return { category_id: null, subcategory_id: null }

  return found.parent_id
    ? { category_id: found.parent_id, subcategory_id: found.id }
    : { category_id: found.id, subcategory_id: null }
}
