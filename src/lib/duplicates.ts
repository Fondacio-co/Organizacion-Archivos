import { normalize, splitName } from "./rename"
import type { DriveFile } from "./types"

export interface DuplicateInfo {
  /** Clave del grupo: los archivos con la misma clave son duplicados entre sí */
  group: string
  kind: "identical" | "sameName"
  /** Cuántos archivos hay en el grupo (incluido este) */
  count: number
  /** Explicación corta para mostrar debajo del nombre */
  reason: string
}

/**
 * Nombre "base" para comparar: sin extensión, sin mayúsculas ni tildes, sin
 * restos de copias ("Copia de …", "… (1)", "… - copia") y con separadores unificados.
 */
export function comparableName(file: Pick<DriveFile, "name" | "native">): string {
  return normalize(splitName(file).base)
    .replace(/^(copia de|copy of)\s+/, "")
    .replace(/\s*\(\d+\)$/, "")
    .replace(/[\s_-]+(copia|copy)$/, "")
    .replace(/[\s_-]+/g, " ")
    .trim()
}

/**
 * Encuentra archivos duplicados en la carpeta (y subcarpetas):
 * 1. Copias idénticas: mismo contenido (huella md5 de Drive), aunque tengan otro nombre.
 * 2. Mismo nombre: mismo nombre y mismo tipo de archivo, aunque estén en otra subcarpeta.
 * Si un archivo es copia idéntica, ese motivo tiene prioridad.
 */
export function findDuplicates(files: DriveFile[]): Map<string, DuplicateInfo> {
  const out = new Map<string, DuplicateInfo>()

  const byMd5 = new Map<string, DriveFile[]>()
  for (const f of files) if (f.md5) byMd5.set(f.md5, [...(byMd5.get(f.md5) ?? []), f])
  for (const [md5, group] of byMd5) {
    if (group.length < 2) continue
    for (const f of group)
      out.set(f.id, {
        group: `md5:${md5}`,
        kind: "identical",
        count: group.length,
        reason: `Copia idéntica: ${group.length} archivos con el mismo contenido`,
      })
  }

  const byName = new Map<string, DriveFile[]>()
  for (const f of files) {
    const key = `${f.kind}:${comparableName(f)}`
    if (key.endsWith(":")) continue
    byName.set(key, [...(byName.get(key) ?? []), f])
  }
  for (const [key, group] of byName) {
    if (group.length < 2) continue
    for (const f of group) {
      if (out.has(f.id)) continue
      out.set(f.id, {
        group: `name:${key}`,
        kind: "sameName",
        count: group.length,
        reason: `Mismo nombre que ${group.length - 1} ${group.length === 2 ? "archivo" : "archivos"} más`,
      })
    }
  }
  return out
}
