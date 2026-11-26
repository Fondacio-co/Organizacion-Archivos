import { afterEach, describe, expect, it } from "vitest"
import {
  DEFAULT_ADMINS,
  DEFAULT_CATALOG,
  entryError,
  isEmail,
  parseCatalog,
  removeEntry,
  similarCode,
  upsertEntry,
  type CatalogEntry,
} from "./catalog"
import { complianceIssue, isCompliant, isSinFecha, nomenParts, defaultNomen, setCatalog } from "./nomenclature"

const entry = (patch: Partial<CatalogEntry> = {}): CatalogEntry => ({
  code: "EDU",
  label: "Educación Ambiental",
  color: "#2E7D32",
  ...patch,
})

afterEach(() => setCatalog(DEFAULT_CATALOG))

describe("validaciones al crear o editar", () => {
  it("acepta un código nuevo bien escrito", () => {
    expect(entryError(entry(), DEFAULT_CATALOG, "bloques")).toBeNull()
  })
  it.each([
    ["ED", "3 letras"],
    ["EDUC", "3 letras"],
    ["ED1", "3 letras"],
    ["FOR", "Ya existe un bloque"],
    ["IAC", "Ya existe un tipo"],
    ["ADC", "no se puede usar"],
  ])("rechaza el código %s", (code, msg) => {
    expect(entryError(entry({ code }), DEFAULT_CATALOG, "bloques")).toContain(msg)
  })
  it("exige nombre y color", () => {
    expect(entryError(entry({ label: " " }), DEFAULT_CATALOG, "bloques")).toContain("nombre")
    expect(entryError(entry({ color: "rojo" }), DEFAULT_CATALOG, "tipos")).toContain("color")
  })
  it("al editar no se queja de que el código ya exista", () => {
    expect(entryError(entry({ code: "FOR", label: "Formación y Talleres" }), DEFAULT_CATALOG, "bloques", "FOR")).toBeNull()
  })
  it("avisa si el código se parece a uno existente", () => {
    expect(similarCode("FOX", DEFAULT_CATALOG, "bloques")?.code).toBe("FOR")
    expect(similarCode("EDU", DEFAULT_CATALOG, "bloques")).toBeNull()
  })
})

describe("crear, editar y eliminar", () => {
  it("agrega al final y al editar conserva su lugar", () => {
    const c1 = upsertEntry(DEFAULT_CATALOG, "bloques", entry())
    expect(c1.bloques.map((b) => b.code)).toEqual(["FOR", "CAM", "SOS", "BYC", "GEN", "EDU"])
    const edited = upsertEntry(c1, "bloques", { code: "CAM", label: "Campus", color: "#00A3B4" })
    expect(edited.bloques.map((b) => b.code)).toEqual(["FOR", "CAM", "SOS", "BYC", "GEN", "EDU"])
    const c2 = upsertEntry(c1, "bloques", entry({ label: "Educación", color: "#1565C0" }))
    expect(c2.bloques.filter((b) => b.code === "EDU")).toEqual([{ code: "EDU", label: "Educación", color: "#1565C0" }])
  })
  it("guarda 'va sin fecha' solo en tipos", () => {
    const c = upsertEntry(DEFAULT_CATALOG, "tipos", entry({ code: "INV", sinFecha: true }))
    expect(c.tipos.find((t) => t.code === "INV")?.sinFecha).toBe(true)
    const b = upsertEntry(DEFAULT_CATALOG, "bloques", entry({ sinFecha: true }))
    expect(b.bloques.find((x) => x.code === "EDU")?.sinFecha).toBeUndefined()
  })
  it("elimina, pero siempre deja al menos uno", () => {
    expect(removeEntry(DEFAULT_CATALOG, "bloques", "SOS").bloques.some((b) => b.code === "SOS")).toBe(false)
    const one = { ...DEFAULT_CATALOG, bloques: [DEFAULT_CATALOG.bloques[0]] }
    expect(() => removeEntry(one, "bloques", one.bloques[0].code)).toThrow()
  })
})

describe("administradores", () => {
  it("por defecto son la cuenta del proyecto y Soraya Guerrero", () => {
    expect(DEFAULT_ADMINS).toEqual(["pruebas_ucatolica@fondacio-co.org", "s.guerrero@fondacio-co.org"])
    expect(DEFAULT_ADMINS.every(isEmail)).toBe(true)
  })
  it("valida el formato del correo a agregar", () => {
    expect(isEmail("nueva.persona@fondacio-co.org")).toBe(true)
    expect(isEmail("sin-arroba.fondacio-co.org")).toBe(false)
    expect(isEmail("con espacio@fondacio-co.org")).toBe(false)
  })
})

describe("lectura del archivo .json", () => {
  it("limpia códigos en minúscula, repetidos y colores inválidos", () => {
    const c = parseCatalog({
      bloques: [
        { code: "edu", label: "Educación", color: "verde" },
        { code: "EDU", label: "Repetido", color: "#000000" },
        { code: "X", label: "Inválido", color: "#000000" },
      ],
      tipos: [{ code: "INV", label: "Inventarios", color: "#1565c0", sinFecha: true }],
    })
    expect(c?.bloques).toEqual([{ code: "EDU", label: "Educación", color: expect.stringMatching(/^#[0-9A-F]{6}$/) }])
    expect(c?.tipos[0]).toEqual({ code: "INV", label: "Inventarios", color: "#1565C0", sinFecha: true })
  })
  it("un archivo dañado o vacío devuelve null (se usan los códigos de fábrica)", () => {
    expect(parseCatalog(null)).toBeNull()
    expect(parseCatalog("texto")).toBeNull()
    expect(parseCatalog({ bloques: [], tipos: [] })).toBeNull()
  })
})

describe("las reglas de nombres usan el catálogo vigente", () => {
  it("un bloque creado cuenta como válido de inmediato", () => {
    expect(isCompliant("EDU_IAC_2026-05_JornadaSiembra_v01")).toBe(false)
    setCatalog(upsertEntry(DEFAULT_CATALOG, "bloques", entry()))
    expect(isCompliant("EDU_IAC_2026-05_JornadaSiembra_v01")).toBe(true)
    expect(nomenParts("edu_iac_jornada siembra", "2026-05-02T12:00:00Z", defaultNomen).bloque).toBe("EDU")
  })
  it("un tipo nuevo 'sin fecha' no recibe fecha automática", () => {
    setCatalog(upsertEntry(DEFAULT_CATALOG, "tipos", entry({ code: "INV", label: "Inventarios", sinFecha: true })))
    expect(isSinFecha("INV")).toBe(true)
    expect(nomenParts("GEN_INV_bodega", "2026-05-02T12:00:00Z", defaultNomen).date).toBe("")
  })
  it("al eliminar un bloque, sus archivos pasan a no cumplir y el motivo lo dice", () => {
    setCatalog(removeEntry(DEFAULT_CATALOG, "bloques", "SOS"))
    expect(isCompliant("SOS_IAC_2026_Algo_v01")).toBe(false)
    expect(complianceIssue("SOS_IAC_2026_Algo_v01")).toContain("Falta el bloque")
  })
})
