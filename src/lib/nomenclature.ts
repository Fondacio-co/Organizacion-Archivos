/*
 * Nomenclatura del cliente:  BLOQUE_TIPO_FECHA_Descripcion_Version
 * Ejemplo:                   CAM_IAC_2026-05-30_JornadaSiembra_v01
 * Los códigos de bloque y tipo vienen del catálogo (catalog.ts), que los
 * administradores editan desde la pestaña Configuración.
 */

import { DEFAULT_CATALOG, type Catalog, type CatalogEntry } from "./catalog"

/** Código de bloque (FOR, CAM…) */
export type Bloque = string
/** Código de tipo (ACT, IAC…) */
export type Tipo = string

let catalog: Catalog = DEFAULT_CATALOG
let CODE_RE: RegExp
let VALID_RE: RegExp

/** Rehace las expresiones que dependen de los códigos */
function rebuild() {
  const bloques = catalog.bloques.map((b) => b.code).join("|")
  const tipos = catalog.tipos.map((t) => t.code).join("|")
  CODE_RE = new RegExp(`^(?:ADC_)?(?:(${bloques})_)?(?:(${tipos})_)?`, "i")
  VALID_RE = new RegExp(
    `^(${bloques})_(${tipos})_` +
      `(?<date>\\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\\d|3[01]))?|-S[12]|-\\d{4})?_)?` +
      // la versión es opcional
      `[A-Z0-9][A-Za-z0-9]*(_(v\\d{2}|FINAL))?$`
  )
}
rebuild()

/** Cambia el catálogo vigente (al cargarlo del Drive o al editarlo) */
export function setCatalog(next: Catalog) {
  catalog = next
  rebuild()
}

export function getCatalog(): Catalog {
  return catalog
}

export const bloqueInfo = (code: string): CatalogEntry | undefined =>
  catalog.bloques.find((b) => b.code === code)
export const tipoInfo = (code: string): CatalogEntry | undefined =>
  catalog.tipos.find((t) => t.code === code)
export const isBloque = (code: string) => !!bloqueInfo(code)
export const isTipo = (code: string) => !!tipoInfo(code)
/** Tipos que normalmente van sin fecha (manuales, fichas, formatos…) */
export const isSinFecha = (code: string) => !!tipoInfo(code)?.sinFecha

/** "auto" = respeta la fecha que ya trae el nombre (con su precisión) */
export type DatePrecision = "auto" | "day" | "month" | "year" | "none"

/** "keep" = la que ya tiene (o ninguna), "none" = quitarla, v01…v20, FINAL */
export const VERSIONS: string[] = [
  "keep",
  "none",
  ...Array.from({ length: 20 }, (_, i) => `v${String(i + 1).padStart(2, "0")}`),
  "FINAL",
]
export type VersionChoice = string
/** Versión bien escrita: v01…v99 o FINAL */
export const VERSION_FORMAT = /^(v\d{2}|FINAL)$/

/** Lo que el usuario corrige a mano para un archivo concreto en la vista previa */
export interface NomenOverride {
  description?: string
  date?: string
}

export interface NomenRule {
  /** "" = mantener el que ya trae cada archivo */
  bloque: Bloque | ""
  /** "" = mantener el que ya trae cada archivo */
  tipo: Tipo | ""
  precision: DatePrecision
  /** "AAAA-MM-DD"; vacío = cada archivo usa la suya */
  date: string
  /** Vacío = se toma del nombre actual de cada archivo */
  description: string
  version: VersionChoice
  perFile: Record<string, NomenOverride>
}

export const defaultNomen: NomenRule = {
  bloque: "",
  tipo: "",
  precision: "auto",
  date: "",
  description: "",
  version: "keep",
  perFile: {},
}

const CONNECTORS = new Set(["de", "del", "la", "el", "los", "las", "y", "e", "en", "para", "por", "con", "a", "al", "un", "una"])

/** "jornada de siembra" → "JornadaSiembra" (sin espacios, tildes ni ñ) */
export function toDescription(text: string): string {
  const plain = text.normalize("NFD").replace(/[̀-ͯ]/g, "")
  // separa también palabras pegadas tipo "informeMensual"
  let words = plain
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
  // solo se quitan conectores escritos en minúscula ("de", "la"); "ElPerdon" es un nombre propio
  const meaningful = words.filter((w) => !CONNECTORS.has(w))
  if (meaningful.length) words = meaningful
  return words
    .map((w) => {
      const word = w.length > 3 && w === w.toUpperCase() ? w.toLowerCase() : w
      return word[0].toUpperCase() + word.slice(1)
    })
    .join("")
}

/** Fecha o periodo dentro de un nombre: 2026, 2026-05, 2026-05-30, 2026-S1 (semestre), 2024-2026 (rango) */
const DATE_RE = /(?:^|[_\s])(\d{4}(?:-(?:\d{4}|S[12]|\d{2}(?:-\d{2})?))?)(?=[_\s]|$)/i
/** Fotos de celular/cámara: IMG_20250312_101522, PXL_20250312… */
const CAMERA_RE = /^(?:IMG|VID|PXL|DSC|MVIMG)[_-]?(\d{4})(\d{2})(\d{2})/i
/** Ruido típico: "WhatsApp Image", "Captura de pantalla", "at 10.41.22" */
const NOISE_RE = /^(?:whatsapp (?:image|video)|captura de pantalla|screenshot|scan|escaneo)\b|\bat \d{1,2}\.\d{2}\.\d{2}\b/gi
const VERSION_RE = /[_\s-]*(v\d{1,2}|final)\s*$/i

export interface ParsedName {
  bloque?: Bloque
  tipo?: Tipo
  date?: string
  version?: string
  /** Lo que queda como descripción, ya limpio */
  description: string
}

/** Intenta reconocer las partes de un nombre existente (también los antiguos con ADC_) */
export function parseName(base: string): ParsedName {
  // quita restos de copias: "Copia de …", "… (1)"
  let rest = base
    .trim()
    .replace(/^copia de\s+/i, "")
    .replace(/\s*\(\d+\)$/, "")
  const out: ParsedName = { description: "" }
  const codes = rest.match(CODE_RE)
  if (codes) {
    out.bloque = codes[1]?.toUpperCase() as Bloque | undefined
    out.tipo = codes[2]?.toUpperCase() as Tipo | undefined
    rest = rest.slice(codes[0].length)
  }
  const v = rest.match(VERSION_RE)
  if (v) {
    out.version = /final/i.test(v[1]) ? "FINAL" : `v${v[1].slice(1).padStart(2, "0")}`
    rest = rest.slice(0, v.index)
  }
  const cam = rest.match(CAMERA_RE)
  if (cam) {
    out.date = `${cam[1]}-${cam[2]}-${cam[3]}`
    rest = rest.slice(cam[0].length)
  } else {
    const d = rest.match(DATE_RE)
    if (d) {
      out.date = d[1].toUpperCase() // 2026-s1 → 2026-S1
      rest = rest.replace(d[0], " ")
    }
  }
  rest = rest
    .replace(NOISE_RE, " ")
    .split(/[_\s-]+/)
    .filter((t) => !/^\d{5,}$/.test(t)) // números largos sin significado (horas, contadores)
    .join(" ")
  out.description = toDescription(rest)
  return out
}

/**
 * Fechas válidas: AAAA, AAAA-MM, AAAA-MM-DD, y también periodos:
 * AAAA-S1 / AAAA-S2 (semestre) y AAAA-AAAA (rango de años, el segundo mayor).
 */
const DATE_ONLY_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?|-S[12]|-\d{4})?$/
/** Semestre o rango de años */
const PERIOD_RE = /^\d{4}-(S[12]|\d{4})$/

function isValidDateText(d: string): boolean {
  if (!DATE_ONLY_RE.test(d)) return false
  const range = d.match(/^(\d{4})-(\d{4})$/)
  return !range || Number(range[2]) > Number(range[1])
}

export const DATE_FORMATS_HELP = "AAAA, AAAA-MM, AAAA-MM-DD, AAAA-S1/S2 (semestre) o AAAA-AAAA (rango)"

/** Explica en palabras simples por qué un nombre no cumple (null si cumple) */
export function complianceIssue(base: string): string | null {
  if (isCompliant(base)) return null
  const p = base.split("_")
  if (p[0] === "ADC") return "Empieza con ADC, que ya no se usa"
  if (!isBloque(p[0]))
    return `Falta el bloque al inicio (${catalog.bloques.map((b) => b.code).join(", ")})`
  if (!p[1] || !isTipo(p[1])) return "Falta el tipo después del bloque (ACT, IAC, MAN…)"
  // la versión es opcional: si está, va al final como v01…v99 o FINAL
  const last = p[p.length - 1]
  const hasVersion = p.length > 3 && VERSION_FORMAT.test(last)
  if (!hasVersion && p.length > 3 && /^(v\d|v\d{3,}|V\d+|final|Final)$/.test(last))
    return "La versión va como v01, v02… o FINAL"
  const middle = p.slice(2, hasVersion ? -1 : undefined)
  if (middle.length === 0 || (middle.length === 1 && DATE_ONLY_RE.test(middle[0])))
    return "Falta la descripción"
  if (middle.length > 2) return "La descripción va junta, sin guiones bajos"
  if (middle.length === 2 && !isValidDateText(middle[0]))
    return `La fecha debe ir como ${DATE_FORMATS_HELP}`
  return "La descripción va sin espacios ni tildes, con mayúscula en cada palabra"
}

/** ¿El nombre (sin extensión) sigue la nomenclatura? */
export function isCompliant(base: string): boolean {
  const m = base.match(VALID_RE)
  if (!m) return false
  const date = m.groups?.date?.slice(0, -1)
  return !date || isValidDateText(date)
}

export const DATE_LEN: Record<Exclude<DatePrecision, "auto">, number> = { day: 10, month: 7, year: 4, none: 0 }

/**
 * De dónde salió la fecha: escrita a mano para este archivo, elegida para todos,
 * ya venía en el nombre, o tomada de la fecha de modificación (la menos confiable).
 */
export type DateSource = "manual" | "global" | "name" | "file" | "none"

export interface NomenParts {
  bloque: Bloque | ""
  tipo: Tipo | ""
  date: string
  dateSource: DateSource
  description: string
  version: string
  /** Qué falta para poder sugerir el nombre (null = está completo) */
  missing: string | null
}

/** Fecha de modificación en la hora local (no UTC): "2026-11-25" */
export function localDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const isValidDate = isValidDateText

/** ¿Es un semestre (2026-S1) o un rango de años (2024-2026)? */
export const isPeriod = (d: string) => PERIOD_RE.test(d)

/**
 * Calcula cada parte del nombre de un archivo. Lo que el usuario no eligió
 * se toma de lo que el nombre actual ya trae (bloque, tipo, fecha, versión).
 */
export function nomenParts(
  currentBase: string,
  modifiedTime: string,
  rule: NomenRule,
  override: NomenOverride = {}
): NomenParts {
  const parsed = parseName(currentBase)
  // "2026-s1" escrito a mano cuenta como "2026-S1"
  if (override.date) override = { ...override, date: override.date.trim().toUpperCase() }
  const bloque = rule.bloque || parsed.bloque || ""
  const tipo = rule.tipo || parsed.tipo || ""

  let date = ""
  let dateSource: DateSource = "none"
  if (rule.precision === "auto") {
    if (override.date && isValidDate(override.date)) [date, dateSource] = [override.date, "manual"]
    else if (rule.date) [date, dateSource] = [rule.date, "global"]
    else if (parsed.date) [date, dateSource] = [parsed.date, "name"]
    else if (!(tipo && isSinFecha(tipo))) [date, dateSource] = [localDate(modifiedTime), "file"]
  } else {
    const len = DATE_LEN[rule.precision]
    if (len) {
      // un periodo (2026-S1, 2024-2026) solo se puede recortar a año; para mes o día no sirve
      const fromName =
        parsed.date && (isPeriod(parsed.date) ? len === 4 : parsed.date.length >= len)
      if (override.date && override.date.length >= len) [date, dateSource] = [override.date, "manual"]
      else if (rule.date) [date, dateSource] = [rule.date, "global"]
      else if (fromName) [date, dateSource] = [parsed.date!, "name"]
      else [date, dateSource] = [localDate(modifiedTime), "file"]
      date = date.slice(0, len)
    }
  }

  const description =
    override.description !== undefined
      ? toDescription(override.description)
      : toDescription(rule.description) || parsed.description

  const version =
    rule.version === "keep" ? (parsed.version ?? "") : rule.version === "none" ? "" : rule.version

  const missing = !bloque
    ? "Elige el bloque"
    : !tipo
      ? "Elige el tipo"
      : !description
        ? "Falta la descripción"
        : date && !isValidDate(date)
          ? "Revisa la fecha"
          : null
  return { bloque, tipo, date, dateSource, description, version, missing }
}

/** Arma el nombre (sin extensión) para un archivo. Devuelve "" si falta bloque o tipo. */
export function buildNomenName(
  currentBase: string,
  modifiedTime: string,
  rule: NomenRule,
  override?: NomenOverride
): string {
  const p = nomenParts(currentBase, modifiedTime, rule, override)
  if (!p.bloque || !p.tipo) return ""
  return [p.bloque, p.tipo, p.date, p.description, p.version].filter(Boolean).join("_")
}
