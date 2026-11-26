import { describe, expect, it } from "vitest"
import {
  buildNomenName,
  complianceIssue,
  defaultNomen,
  isCompliant,
  nomenParts,
  parseName,
  toDescription,
  type NomenRule,
} from "./nomenclature"

const MOD = "2026-11-20T15:00:00Z"
const rule = (patch: Partial<NomenRule> = {}): NomenRule => ({ ...defaultNomen, ...patch })
const build = (name: string, patch: Partial<NomenRule> = {}, mod = MOD) =>
  buildNomenName(name, mod, rule(patch))

describe("toDescription", () => {
  it("une palabras con mayúscula inicial y quita tildes", () => {
    expect(toDescription("jornada de siembra")).toBe("JornadaSiembra")
    expect(toDescription("Educación ambiental")).toBe("EducacionAmbiental")
    expect(toDescription("diseño del año")).toBe("DisenoAno")
  })
  it("respeta palabras ya unidas y nombres propios", () => {
    expect(toDescription("JornadaSiembra")).toBe("JornadaSiembra")
    expect(toDescription("TiempoComunitario ElPerdon")).toBe("TiempoComunitarioElPerdon")
  })
  it("pasa a minúscula las palabras en MAYÚSCULAS largas, pero no siglas cortas", () => {
    expect(toDescription("informe MARZO")).toBe("InformeMarzo")
    expect(toDescription("reunión ONG")).toBe("ReunionONG")
  })
  it("si solo hay conectores no queda vacío", () => {
    expect(toDescription("de la")).toBe("DeLa")
  })
  it("texto vacío da vacío", () => {
    expect(toDescription("   ")).toBe("")
  })
})

describe("isCompliant / complianceIssue", () => {
  it.each([
    "CAM_IAC_2026-05-30_JornadaSiembra_v01",
    "GEN_MAN_GuiaOrganizacionNomenclatura_v01",
    "GEN_BDD_2026_EquivalenciasNombres_v01",
    "FOR_ACT_2026-05_ReunionEquipo_FINAL",
  ])("acepta %s", (n) => {
    expect(isCompliant(n)).toBe(true)
    expect(complianceIssue(n)).toBeNull()
  })

  it.each([
    "GEN_IRE_2026-S1_PresentacionResultados_v01",
    "GEN_IRE_2026-S2_PresentacionResultados_FINAL",
    "GEN_IRE_2024-2026_MejorasYObrasCasa_v01",
  ])("acepta periodos: %s", (n) => {
    expect(isCompliant(n)).toBe(true)
    expect(complianceIssue(n)).toBeNull()
  })

  it.each([
    ["GEN_IRE_2026-S3_Algo_v01", "fecha"],
    ["GEN_IRE_2026-2024_Algo_v01", "fecha"],
    ["GEN_IRE_2026-S1_Presentacion_Resultados_v01", "junta"],
  ])("rechaza periodos mal escritos: %s", (n, word) => {
    expect(isCompliant(n)).toBe(false)
    expect(complianceIssue(n)?.toLowerCase()).toContain(word)
  })

  it.each([
    ["ADC_CAM_IAC_2026-05-30_JornadaSiembra_v01", "ADC"],
    ["CAM_IAC_2026-05-30_JornadaSiembra", "versión"],
    ["XYZ_IAC_2026_Algo_v01", "bloque"],
    ["CAM_XXX_2026_Algo_v01", "tipo"],
    ["GEN_MAT_2026-05_TiempoComunitario_ElPerdon_v01", "junta"],
    ["CAM_IAC_2026-13-01_Algo_v01", "fecha"],
    ["CAM_IAC_2026-05-30_v01", "descripción"],
    ["CAM_IAC_2026_jornada siembra_v01", "espacios"],
  ])("rechaza %s y explica el motivo (%s)", (n, word) => {
    expect(isCompliant(n)).toBe(false)
    expect(complianceIssue(n)?.toLowerCase()).toContain(word.toLowerCase())
  })
})

describe("parseName", () => {
  it("reconoce las partes de un nombre casi correcto", () => {
    expect(parseName("GEN_MAT_2026-05_TiempoComunitario_ElPerdon_v01")).toMatchObject({
      bloque: "GEN",
      tipo: "MAT",
      date: "2026-05",
      version: "v01",
      description: "TiempoComunitarioElPerdon",
    })
  })
  it("quita el ADC antiguo", () => {
    expect(parseName("ADC_CAM_IAC_2026-05-30_JornadaSiembra_v03")).toMatchObject({
      bloque: "CAM",
      tipo: "IAC",
      version: "v03",
    })
  })
  it("reconoce códigos en minúscula", () => {
    expect(parseName("gen_man_guia de organizacion")).toMatchObject({ bloque: "GEN", tipo: "MAN" })
  })
  it("saca la fecha de fotos de celular y no deja números basura", () => {
    const p = parseName("IMG_20250312_101522")
    expect(p.date).toBe("2025-03-12")
    expect(p.description).toBe("")
  })
  it("limpia nombres de WhatsApp", () => {
    const p = parseName("WhatsApp Image 2025-03-12 at 10.41.22")
    expect(p.date).toBe("2025-03-12")
    expect(p.description).toBe("")
  })
  it("quita restos de copias", () => {
    expect(parseName("Copia de Informe anual (2)").description).toBe("InformeAnual")
  })
  it("\"final\" al final del nombre se entiende como versión aprobada", () => {
    expect(parseName("Copia de Informe final (2)")).toMatchObject({ description: "Informe", version: "FINAL" })
  })
  it("normaliza versiones v1 → v01 y final → FINAL", () => {
    expect(parseName("Acta reunion v2").version).toBe("v02")
    expect(parseName("Acta reunion final").version).toBe("FINAL")
  })
  it("no confunde un año dentro del texto con un código", () => {
    expect(parseName("Informe 2025 resultados").date).toBe("2025")
  })
})

describe("buildNomenName (sugerencia automática)", () => {
  it("corrige solo lo necesario y respeta la fecha del nombre", () => {
    expect(build("GEN_MAT_2026-05_TiempoComunitario_ElPerdon_v01")).toBe(
      "GEN_MAT_2026-05_TiempoComunitarioElPerdon_v01"
    )
  })
  it("un archivo que ya cumple queda igual", () => {
    expect(build("CAM_IAC_2026-05-30_JornadaSiembra_v01")).toBe("CAM_IAC_2026-05-30_JornadaSiembra_v01")
    expect(build("GEN_MAN_GuiaOrganizacionNomenclatura_v01")).toBe("GEN_MAN_GuiaOrganizacionNomenclatura_v01")
  })
  it("sin bloque o tipo no inventa nada", () => {
    expect(build("Informe mensual enero 2025")).toBe("")
    expect(nomenParts("Informe mensual enero 2025", MOD, rule()).missing).toBe("Elige el bloque")
    expect(nomenParts("Informe", MOD, rule({ bloque: "CAM" })).missing).toBe("Elige el tipo")
  })
  it("manuales, fichas y formatos sin fecha no reciben una", () => {
    expect(build("GEN_MAN_guia uso")).toBe("GEN_MAN_GuiaUso_v01")
  })
  it("el bloque elegido reemplaza al que traía", () => {
    expect(build("GEN_MAT_2026-05_Algo_v01", { bloque: "FOR" })).toBe("FOR_MAT_2026-05_Algo_v01")
  })
  it("la versión elegida reemplaza a la actual", () => {
    expect(build("GEN_MAT_2026-05_Algo_v01", { version: "FINAL" })).toBe("GEN_MAT_2026-05_Algo_FINAL")
  })
  it("una precisión fija recorta o completa la fecha", () => {
    expect(build("GEN_MAT_2026-05-30_Algo_v01", { precision: "month" })).toBe("GEN_MAT_2026-05_Algo_v01")
    expect(build("GEN_MAT_Algo_v01", { precision: "year" })).toBe("GEN_MAT_2026_Algo_v01")
  })
  it("la descripción escrita a mano para un archivo gana", () => {
    const name = buildNomenName("IMG_20250312_101522", MOD, rule({ bloque: "CAM", tipo: "MAT" }), {
      description: "foto de siembra",
    })
    expect(name).toBe("CAM_MAT_2025-03-12_FotoSiembra_v01")
  })
  it("usa la fecha LOCAL del archivo, no la de UTC", () => {
    // 26 nov 03:00 UTC = 25 nov 22:00 en Colombia
    const p = nomenParts("CAM_IAC_Algo", "2026-11-26T03:00:00Z", rule())
    expect(p.date).toBe("2026-11-25")
    expect(p.dateSource).toBe("file")
  })
  it("respeta semestres y rangos de años en vez de cambiarlos por la fecha del archivo", () => {
    expect(build("GEN_IRE_2026-S1_PresentacionResultados_v01")).toBe("GEN_IRE_2026-S1_PresentacionResultados_v01")
    expect(build("GEN_IRE_2024-2026_MejorasYObrasCasa_v01")).toBe("GEN_IRE_2024-2026_MejorasYObrasCasa_v01")
    expect(build("informe gen ire 2026-s2 resultados", { bloque: "GEN", tipo: "IRE" })).toBe(
      "GEN_IRE_2026-S2_InformeGenIreResultados_v01"
    )
  })
  it("con precisión Año un periodo se recorta al año; con Mes o Día usa la fecha del archivo", () => {
    expect(build("GEN_IRE_2026-S1_Algo_v01", { precision: "year" })).toBe("GEN_IRE_2026_Algo_v01")
    expect(build("GEN_IRE_2024-2026_Algo_v01", { precision: "month" })).toBe("GEN_IRE_2026-11_Algo_v01")
  })
  it("un semestre escrito a mano en minúscula se acepta", () => {
    const p = nomenParts("GEN_IRE_Algo_v01", MOD, rule(), { date: "2026-s2" })
    expect(p.date).toBe("2026-S2")
    expect(p.missing).toBeNull()
  })
  it("una fecha imposible en el nombre no se acepta como buena", () => {
    const p = nomenParts("CAM_IAC_2026-13-01_Algo_v01", MOD, rule())
    expect(p.missing).toMatch(/fecha/i)
  })
})
