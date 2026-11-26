import type { DriveFile } from "./types"

import { buildNomenName, defaultNomen, isCompliant, isTipo, localDate, nomenParts, type NomenRule } from "./nomenclature"

export type RenameMode = "nomen" | "rename" | "replace" | "affix" | "number" | "format" | "manual"

export type NumberStyle = "underscore" | "space" | "dash" | "paren"

export interface RenameRule {
  mode: RenameMode
  keepExtension: boolean
  nomen: NomenRule
  /** Un mismo nombre para todos; si son varios, se numeran solos */
  rename: { name: string; style: NumberStyle; start: number }
  replace: { find: string; with: string; matchCase: boolean; regex: boolean }
  affix: { prefix: string; suffix: string }
  number: { pattern: string; start: number; digits: number }
  format: {
    textCase: "keep" | "lower" | "upper" | "title" | "sentence"
    separator: "keep" | "space" | "underscore" | "dash"
    removeAccents: boolean
    collapseSpaces: boolean
  }
  /** Nombres escritos a mano (sin extensión si keepExtension está activo) */
  manual: Record<string, string>
}

export const defaultRule: RenameRule = {
  mode: "nomen",
  keepExtension: true,
  nomen: defaultNomen,
  rename: { name: "", style: "underscore", start: 1 },
  replace: { find: "", with: "", matchCase: false, regex: false },
  affix: { prefix: "", suffix: "" },
  number: { pattern: "{nombre}_{n}", start: 1, digits: 2 },
  format: { textCase: "keep", separator: "keep", removeAccents: false, collapseSpaces: true },
  manual: {},
}

export type PreviewStatus =
  | "change"
  | "same"
  | "empty"
  | "duplicate"
  | "locked"
  | "invalid"
  /** Nomenclatura: falta algún dato (normalmente la descripción) */
  | "incomplete"

export interface PreviewItem {
  file: DriveFile
  newName: string
  status: PreviewStatus
  /** Explicación corta cuando hay un problema (ej. "Elige el tipo") */
  note?: string
}

export function splitName(file: Pick<DriveFile, "name" | "native">): { base: string; ext: string } {
  if (file.native) return { base: file.name, ext: "" }
  const i = file.name.lastIndexOf(".")
  if (i <= 0 || file.name.length - i > 6 || /\s/.test(file.name.slice(i)))
    return { base: file.name, ext: "" }
  return { base: file.name.slice(0, i), ext: file.name.slice(i) }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

/** Normaliza para buscar sin importar mayúsculas ni tildes */
export function normalize(s: string) {
  return stripAccents(s).toLowerCase()
}

export function buildRegex(rule: RenameRule): RegExp | null | "invalid" {
  const { find, matchCase, regex } = rule.replace
  if (!find) return null
  try {
    return new RegExp(regex ? find : escapeRe(find), matchCase ? "g" : "gi")
  } catch {
    return "invalid"
  }
}

function applyFormat(base: string, f: RenameRule["format"]): string {
  let s = base
  if (f.removeAccents) s = stripAccents(s)
  if (f.separator !== "keep") {
    const sep = { space: " ", underscore: "_", dash: "-" }[f.separator]
    s = s.replace(/[\s_-]+/g, sep)
  }
  if (f.collapseSpaces) s = s.replace(/\s+/g, " ").trim()
  const lower = s.toLocaleLowerCase("es")
  switch (f.textCase) {
    case "lower":
      return lower
    case "upper":
      return s.toLocaleUpperCase("es")
    case "title":
      return lower.replace(/(^|[\s_\-(])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase("es"))
    case "sentence":
      return lower.replace(/\p{L}/u, (c) => c.toLocaleUpperCase("es"))
    default:
      return s
  }
}

/** Ejemplo: numbered("Informe", 3, 12, "underscore") → "Informe_03" */
export function numbered(name: string, n: number, total: number, style: NumberStyle): string {
  const digits = Math.max(2, String(total).length)
  const num = String(n).padStart(digits, "0")
  switch (style) {
    case "space":
      return `${name} ${num}`
    case "dash":
      return `${name}-${num}`
    case "paren":
      return `${name} (${n})`
    default:
      return `${name}_${num}`
  }
}

function newNameFor(
  file: DriveFile,
  index: number,
  total: number,
  rule: RenameRule,
  re: RegExp | null
): string {
  const { base, ext } = rule.keepExtension ? splitName(file) : { base: file.name, ext: "" }
  let out = base
  switch (rule.mode) {
    case "nomen":
      out = buildNomenName(base, file.modifiedTime, rule.nomen, rule.nomen.perFile[file.id]) || base
      break
    case "rename": {
      const name = rule.rename.name.trim()
      if (name) {
        out =
          total === 1
            ? name
            : numbered(name, rule.rename.start + index, rule.rename.start + total - 1, rule.rename.style)
      }
      break
    }
    case "replace":
      if (re) {
        const w = rule.replace.with
        out = rule.replace.regex ? base.replace(re, w) : base.replace(re, () => w)
      }
      break
    case "affix":
      out = rule.affix.prefix + base + rule.affix.suffix
      break
    case "number": {
      const n = String(rule.number.start + index).padStart(rule.number.digits, "0")
      const date = localDate(file.modifiedTime)
      out = (rule.number.pattern || "{nombre}_{n}")
        .replaceAll("{n}", n)
        .replaceAll("{nombre}", base)
        .replaceAll("{fecha}", date)
      break
    }
    case "format":
      out = applyFormat(base, rule.format)
      break
    case "manual":
      out = rule.manual[file.id] ?? base
      break
  }
  return (out.trim() + ext).trim()
}

/**
 * Calcula el nombre nuevo de cada archivo seleccionado y detecta problemas:
 * nombres vacíos, nombres repetidos dentro de la misma carpeta y archivos sin permiso.
 */
export function buildPreview(
  selected: DriveFile[],
  allFiles: DriveFile[],
  rule: RenameRule
): { items: PreviewItem[]; regexError: boolean } {
  const re = rule.mode === "replace" ? buildRegex(rule) : null
  if (re === "invalid") {
    return {
      items: selected.map((file) => ({ file, newName: file.name, status: "invalid" })),
      regexError: true,
    }
  }

  const items: PreviewItem[] = selected.map((file, i) => ({
    file,
    newName: newNameFor(file, i, selected.length, rule, re),
    status: "change",
  }))

  // Nomenclatura: si varios archivos de la misma carpeta quedan con el mismo nombre
  // (ej. 5 fotos con la misma descripción), se numeran en la descripción: FotoSiembra01, 02…
  if (rule.mode === "nomen") {
    const groups = new Map<string, PreviewItem[]>()
    for (const it of items) {
      const key = `${it.file.parentId}\u0000${it.newName.toLowerCase()}`
      groups.set(key, [...(groups.get(key) ?? []), it])
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue
      const digits = Math.max(2, String(group.length).length)
      group.forEach((it, i) => {
        const { base, ext } = splitName({ name: it.newName, native: it.file.native })
        const parts = base.split("_")
        const desc = parts[parts.length - 2]
        // sin descripción (solo fecha o códigos) no se numera: falta ese dato
        if (parts.length < 4 || /^\d{4}(-\d{2}){0,2}$/.test(desc) || isTipo(desc)) return
        parts[parts.length - 2] = desc + String(i + 1).padStart(digits, "0")
        it.newName = parts.join("_") + ext
      })
    }
  }

  // Nombre final de cada archivo de la carpeta, para detectar repetidos
  const finalName = new Map<string, string>()
  for (const f of allFiles) finalName.set(f.id, f.name)
  for (const it of items) finalName.set(it.file.id, it.newName)
  const counts = new Map<string, number>()
  for (const f of allFiles) {
    const key = `${f.parentId}\u0000${finalName.get(f.id)!.toLowerCase()}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  for (const it of items) {
    const base = splitName({ name: it.newName, native: it.file.native }).base
    // sin permiso de edición no tiene sentido pedir datos: se avisa primero
    if (!it.file.canRename) {
      it.status = "locked"
      continue
    }
    if (rule.mode === "nomen") {
      const missing = nomenParts(
        splitName(it.file).base,
        it.file.modifiedTime,
        rule.nomen,
        rule.nomen.perFile[it.file.id]
      ).missing
      if (missing) {
        it.status = "incomplete"
        it.note = missing
        continue
      }
    }
    // el nombre sin la extensión original no puede quedar vacío (ej. ".jpg")
    const origExt = splitName(it.file).ext
    const bare = origExt && it.newName.endsWith(origExt) ? it.newName.slice(0, -origExt.length) : base
    if (it.newName === it.file.name) it.status = "same"
    else if (!it.file.canRename) it.status = "locked"
    else if (!base.trim() || !bare.trim()) it.status = "empty"
    else if (rule.mode === "nomen" && !isCompliant(base)) it.status = "incomplete"
    else if ((counts.get(`${it.file.parentId}\u0000${it.newName.toLowerCase()}`) ?? 0) > 1)
      it.status = "duplicate"
  }
  return { items, regexError: false }
}
