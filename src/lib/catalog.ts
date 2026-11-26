/*
 * Catálogo de códigos de la nomenclatura (bloques y tipos).
 * Se guarda como un archivo .json en el Drive de la Fundación para que todos
 * los computadores vean los mismos valores. Si no existe, se usa DEFAULT_CATALOG.
 */

export type CatalogKind = "bloques" | "tipos"

export interface CatalogEntry {
  /** 3 letras mayúsculas: FOR, IAC… No se puede cambiar una vez creado */
  code: string
  /** Nombre o descripción: "Formación", "Informes de actividades" */
  label: string
  /** Color en hexadecimal: #EA5A0C */
  color: string
  /** Solo tipos: manuales, fichas y formatos van sin fecha */
  sinFecha?: boolean
}

export interface Catalog {
  schema: 1
  bloques: CatalogEntry[]
  tipos: CatalogEntry[]
  updatedAt?: string
  updatedBy?: string
}

/** Colores para elegir: la paleta de la Fundación y tonos que se distinguen bien */
export const PALETTE = [
  "#3B3183", // índigo
  "#00A3B4", // turquesa
  "#EA5A0C", // naranja
  "#D81159", // magenta
  "#B08800", // amarillo oscuro (el amarillo puro no se lee sobre blanco)
  "#2E7D32", // verde
  "#1565C0", // azul
  "#6A1B9A", // morado
  "#8D6E63", // café
  "#546E7A", // gris azulado
]

export const DEFAULT_CATALOG: Catalog = {
  schema: 1,
  bloques: [
    { code: "FOR", label: "Formación", color: "#EA5A0C" },
    { code: "CAM", label: "Campus Ambiental", color: "#00A3B4" },
    { code: "SOS", label: "Sede Sostenible", color: "#B08800" },
    { code: "BYC", label: "Bienestar y Cuidado", color: "#D81159" },
    { code: "GEN", label: "General", color: "#3B3183" },
  ],
  tipos: [
    { code: "ACT", label: "Actas de reunión", color: "#3B3183" },
    { code: "ADM", label: "Documentos administrativos", color: "#546E7A" },
    { code: "BDD", label: "Bases de datos, listas y seguimientos", color: "#2E7D32" },
    { code: "COM", label: "Comunicaciones internas y externas", color: "#00A3B4" },
    { code: "FIC", label: "Fichas de programa", color: "#8D6E63", sinFecha: true },
    { code: "FMT", label: "Plantillas y formatos en blanco", color: "#546E7A", sinFecha: true },
    { code: "IAC", label: "Informes de actividades", color: "#EA5A0C" },
    { code: "IDO", label: "Informes para donantes", color: "#D81159" },
    { code: "INC", label: "Informes colaborativos", color: "#6A1B9A" },
    { code: "IRE", label: "Informes de resultados", color: "#1565C0" },
    { code: "MAN", label: "Manuales y protocolos", color: "#3B3183", sinFecha: true },
    { code: "MAT", label: "Material pedagógico", color: "#B08800" },
    { code: "PRY", label: "Proyectos, convocatorias, cronogramas y presupuestos", color: "#00A3B4" },
  ],
}

const CODE_FORMAT = /^[A-Z]{3}$/
const COLOR_FORMAT = /^#[0-9A-Fa-f]{6}$/
/** Palabras que ya significan otra cosa en los nombres */
const RESERVED = new Set(["ADC", "IMG", "VID", "PXL", "DSC"])

/**
 * Revisa y limpia un catálogo leído del archivo. Si viene dañado, devuelve null
 * para que la página siga con los códigos por defecto.
 */
export function parseCatalog(raw: unknown): Catalog | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<Catalog>
  const clean = (list: unknown, kind: CatalogKind): CatalogEntry[] => {
    if (!Array.isArray(list)) return []
    const seen = new Set<string>()
    const out: CatalogEntry[] = []
    for (const e of list) {
      if (!e || typeof e !== "object") continue
      const code = String((e as CatalogEntry).code ?? "").trim().toUpperCase()
      const label = String((e as CatalogEntry).label ?? "").trim()
      let color = String((e as CatalogEntry).color ?? "")
      if (!CODE_FORMAT.test(code) || !label || seen.has(code)) continue
      if (!COLOR_FORMAT.test(color)) color = PALETTE[out.length % PALETTE.length]
      seen.add(code)
      out.push({
        code,
        label,
        color: color.toUpperCase(),
        ...(kind === "tipos" && (e as CatalogEntry).sinFecha ? { sinFecha: true } : {}),
      })
    }
    return out // se respeta el orden del archivo (el de la guía)
  }
  const bloques = clean(r.bloques, "bloques")
  const tipos = clean(r.tipos, "tipos")
  if (!bloques.length || !tipos.length) return null
  return {
    schema: 1,
    bloques,
    tipos,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
    updatedBy: typeof r.updatedBy === "string" ? r.updatedBy : undefined,
  }
}

/** Distancia de edición entre dos códigos cortos (cuántas letras cambian) */
function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
  return dp[a.length][b.length]
}

/**
 * Valida una entrada nueva o editada. Devuelve el error en palabras simples,
 * o null si está bien. `editing` es el código que se está editando (no cambia).
 */
export function entryError(
  entry: CatalogEntry,
  catalog: Catalog,
  kind: CatalogKind,
  editing?: string
): string | null {
  if (!editing) {
    if (!CODE_FORMAT.test(entry.code)) return "El código debe tener exactamente 3 letras (A-Z), sin tildes ni números."
    if (RESERVED.has(entry.code)) return `"${entry.code}" no se puede usar: ya significa otra cosa en los nombres.`
    const all = [...catalog.bloques, ...catalog.tipos]
    const clash = all.find((e) => e.code === entry.code)
    if (clash) {
      const where = catalog.bloques.includes(clash) ? "un bloque" : "un tipo"
      return `Ya existe ${where} con el código ${entry.code} (${clash.label}).`
    }
  }
  if (!entry.label.trim()) return kind === "bloques" ? "Escribe el nombre del bloque." : "Escribe qué tipo de documento es."
  if (entry.label.trim().length > 80) return "El nombre es muy largo (máximo 80 caracteres)."
  if (!COLOR_FORMAT.test(entry.color)) return "Elige un color."
  return null
}

/** Aviso (no error) si el código se parece mucho a uno existente: FRM ≈ FOR */
export function similarCode(code: string, catalog: Catalog, kind: CatalogKind): CatalogEntry | null {
  if (!CODE_FORMAT.test(code)) return null
  return catalog[kind].find((e) => e.code !== code && distance(e.code, code) === 1) ?? null
}

/** Devuelve un catálogo nuevo con la entrada agregada o reemplazada */
export function upsertEntry(catalog: Catalog, kind: CatalogKind, entry: CatalogEntry): Catalog {
  const clean: CatalogEntry = {
    code: entry.code.trim().toUpperCase(),
    label: entry.label.trim(),
    color: entry.color.toUpperCase(),
    ...(kind === "tipos" && entry.sinFecha ? { sinFecha: true } : {}),
  }
  // al editar conserva su lugar en la lista; si es nuevo va al final
  const list = catalog[kind]
  const i = list.findIndex((e) => e.code === clean.code)
  const next = i >= 0 ? list.map((e, j) => (j === i ? clean : e)) : [...list, clean]
  return { ...catalog, [kind]: next }
}

/** Devuelve un catálogo nuevo sin esa entrada (siempre deja al menos una de cada clase) */
export function removeEntry(catalog: Catalog, kind: CatalogKind, code: string): Catalog {
  const list = catalog[kind].filter((e) => e.code !== code)
  if (!list.length) throw new Error("Debe quedar al menos un bloque y un tipo.")
  return { ...catalog, [kind]: list }
}
