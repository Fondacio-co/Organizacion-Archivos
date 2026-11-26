import { describe, expect, it } from "vitest"
import { buildPreview, defaultRule, splitName, type RenameRule } from "./rename"
import { defaultNomen } from "./nomenclature"
import { kindFromMime, type DriveFile } from "./types"

let n = 0
function file(name: string, opts: Partial<DriveFile> = {}): DriveFile {
  const mimeType = opts.mimeType ?? (name.endsWith(".pdf") ? "application/pdf" : "image/jpeg")
  return {
    id: `f${n++}`,
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
const GDOC = "application/vnd.google-apps.document"
const rule = (patch: Partial<RenameRule>): RenameRule => ({ ...defaultRule, ...patch })
const nomen = (patch: Partial<RenameRule["nomen"]> = {}) => rule({ mode: "nomen", nomen: { ...defaultNomen, ...patch } })

describe("splitName", () => {
  it("separa la extensión", () => {
    expect(splitName({ name: "Informe.pdf", native: false })).toEqual({ base: "Informe", ext: ".pdf" })
    expect(splitName({ name: "archivo.tar.gz", native: false })).toEqual({ base: "archivo.tar", ext: ".gz" })
  })
  it("los documentos de Google no tienen extensión", () => {
    expect(splitName({ name: "Acta v1.2", native: true })).toEqual({ base: "Acta v1.2", ext: "" })
  })
  it("no confunde puntos dentro del nombre con extensión", () => {
    expect(splitName({ name: "Acta 30.05 reunión", native: false }).ext).toBe("")
    expect(splitName({ name: ".gitignore", native: false }).ext).toBe("")
  })
})

describe("buildPreview — Nombre nuevo", () => {
  it("con varios archivos los numera y conserva la extensión", () => {
    const fs = [file("a.jpg"), file("b.jpg"), file("c.jpg")]
    const { items } = buildPreview(fs, fs, rule({ mode: "rename", rename: { name: "Foto", style: "underscore", start: 1 } }))
    expect(items.map((i) => i.newName)).toEqual(["Foto_01.jpg", "Foto_02.jpg", "Foto_03.jpg"])
    expect(items.every((i) => i.status === "change")).toBe(true)
  })
  it("no renombra si el nombre queda vacío", () => {
    const fs = [file("a.jpg")]
    const { items } = buildPreview(fs, fs, rule({ mode: "replace", replace: { find: "a", with: "", matchCase: false, regex: false } }))
    expect(items[0].status).toBe("empty")
  })
})

describe("buildPreview — avisos", () => {
  it("bloquea si choca con otro archivo de la misma carpeta", () => {
    const other = file("Foto.jpg")
    const target = file("x.jpg")
    const { items } = buildPreview([target], [other, target], rule({ mode: "rename", rename: { name: "Foto", style: "underscore", start: 1 } }))
    expect(items[0].status).toBe("duplicate")
  })
  it("el mismo nombre en otra carpeta no es problema", () => {
    const other = file("Foto.jpg", { parentId: "p2" })
    const target = file("x.jpg")
    const { items } = buildPreview([target], [other, target], rule({ mode: "rename", rename: { name: "Foto", style: "underscore", start: 1 } }))
    expect(items[0].status).toBe("change")
  })
  it("no toca archivos sin permiso", () => {
    const fs = [file("x.jpg", { canRename: false })]
    const { items } = buildPreview(fs, fs, rule({ mode: "rename", rename: { name: "Foto", style: "underscore", start: 1 } }))
    expect(items[0].status).toBe("locked")
  })
  it("expresión regular inválida se marca y no rompe", () => {
    const fs = [file("x.jpg")]
    const res = buildPreview(fs, fs, rule({ mode: "replace", replace: { find: "(", with: "", matchCase: false, regex: true } }))
    expect(res.regexError).toBe(true)
  })
})

describe("buildPreview — Nomenclatura", () => {
  it("sugiere el nombre corregido sin elegir nada", () => {
    const fs = [file("GEN_MAT_2026-05_TiempoComunitario_ElPerdon_v01", { mimeType: GDOC })]
    const { items } = buildPreview(fs, fs, nomen())
    expect(items[0].newName).toBe("GEN_MAT_2026-05_TiempoComunitarioElPerdon_v01")
    expect(items[0].status).toBe("change")
  })
  it("un archivo que ya cumple aparece sin cambios", () => {
    const fs = [file("CAM_IAC_2026-05-30_JornadaSiembra_v01.pdf")]
    expect(buildPreview(fs, fs, nomen()).items[0].status).toBe("same")
  })
  it("dice qué falta cuando no puede sugerir", () => {
    const fs = [file("Informe mensual.pdf")]
    const { items } = buildPreview(fs, fs, nomen())
    expect(items[0].status).toBe("incomplete")
    expect(items[0].note).toBe("Elige el bloque")
  })
  it("fotos con la misma descripción se numeran en vez de chocar", () => {
    const fs = [file("IMG_20250312_101522.jpg"), file("IMG_20250312_101548.jpg")]
    const { items } = buildPreview(fs, fs, nomen({ bloque: "CAM", tipo: "MAT", description: "foto siembra" }))
    expect(items.map((i) => i.newName)).toEqual([
      "CAM_MAT_2025-03-12_FotoSiembra01.jpg",
      "CAM_MAT_2025-03-12_FotoSiembra02.jpg",
    ])
    expect(items.every((i) => i.status === "change")).toBe(true)
  })
  it("nunca propone renombrar a un nombre que no cumple", () => {
    const fs = [file("CAM_IAC_2026-13-01_Algo_v01.pdf")]
    const { items } = buildPreview(fs, fs, nomen())
    expect(items[0].status).not.toBe("change")
  })
  it("un archivo sin permiso dice \"Sin permiso\" antes que pedir datos", () => {
    const fs = [file("Informe mensual.pdf", { canRename: false })]
    expect(buildPreview(fs, fs, nomen()).items[0].status).toBe("locked")
  })
  it("no renombra archivos de solo lectura aunque la sugerencia sea buena", () => {
    const fs = [file("GEN_MAT_2026-05_Tiempo_Libre_v01", { mimeType: GDOC, canRename: false })]
    expect(buildPreview(fs, fs, nomen()).items[0].status).not.toBe("change")
  })
})
