import { describe, expect, it } from "vitest"
import { comparableName, findDuplicates } from "./duplicates"
import { kindFromMime, type DriveFile } from "./types"

let n = 0
function file(name: string, opts: Partial<DriveFile> = {}): DriveFile {
  const mimeType = opts.mimeType ?? (name.endsWith(".pdf") ? "application/pdf" : "image/jpeg")
  return {
    id: `d${n++}`,
    name,
    mimeType,
    kind: kindFromMime(mimeType),
    native: mimeType.startsWith("application/vnd.google-apps."),
    parentId: "p1",
    path: "",
    modifiedTime: "2026-11-20T15:00:00Z",
    canRename: true,
    canTrash: true,
    ...opts,
  }
}

describe("comparableName", () => {
  it("ignora mayúsculas, tildes, extensión y restos de copias", () => {
    expect(comparableName({ name: "Copia de Informe Técnico (2).pdf", native: false })).toBe("informe tecnico")
    expect(comparableName({ name: "informe_tecnico - copia.pdf", native: false })).toBe("informe tecnico")
  })
})

describe("findDuplicates", () => {
  it("detecta copias idénticas por contenido aunque el nombre sea distinto", () => {
    const a = file("Foto evento.jpg", { md5: "abc" })
    const b = file("IMG_1234.jpg", { md5: "abc" })
    const c = file("Otra.jpg", { md5: "zzz" })
    const d = findDuplicates([a, b, c])
    expect(d.get(a.id)?.kind).toBe("identical")
    expect(d.get(b.id)?.group).toBe(d.get(a.id)?.group)
    expect(d.has(c.id)).toBe(false)
  })
  it("detecta archivos con el mismo nombre en distintas subcarpetas", () => {
    const a = file("Anexo técnico.pdf", { md5: "1", path: "Contratos" })
    const b = file("Anexo tecnico (1).pdf", { md5: "2", path: "Contratos / 2024" })
    const d = findDuplicates([a, b])
    expect(d.get(a.id)?.kind).toBe("sameName")
    expect(d.get(b.id)?.reason).toContain("Mismo nombre")
  })
  it("no mezcla tipos distintos con el mismo nombre (ej. el PDF exportado de un Documento)", () => {
    const a = file("Plan de trabajo", { mimeType: "application/vnd.google-apps.document" })
    const b = file("Plan de trabajo.pdf", { md5: "x" })
    expect(findDuplicates([a, b]).size).toBe(0)
  })
  it("la copia idéntica tiene prioridad sobre el mismo nombre", () => {
    const a = file("Informe.pdf", { md5: "same" })
    const b = file("Copia de Informe.pdf", { md5: "same" })
    const d = findDuplicates([a, b])
    expect(d.get(a.id)?.kind).toBe("identical")
    expect(d.get(b.id)?.kind).toBe("identical")
  })
})
