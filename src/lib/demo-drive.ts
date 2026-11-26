import { DEFAULT_CATALOG } from "./catalog"
import { CatalogConflictError, kindFromMime, type CatalogAdmin, type CatalogFile, type DriveBackend, type DriveFile, type FolderEntry } from "./types"

/* Datos de ejemplo para ver y probar la página sin conectar una cuenta real. */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
  zip: "application/zip",
  gdoc: "application/vnd.google-apps.document",
  gsheet: "application/vnd.google-apps.spreadsheet",
}

/** [carpeta, nombre, tipo, sin permiso, huella del contenido (para simular copias idénticas)] */
const SAMPLE: [path: string, name: string, type: string, locked?: boolean, md5?: string][] = [
  ["", "GEN_MAN_GuiaOrganizacionNomenclatura_v01", "gdoc"],
  ["", "CAM_IAC_2026-05-30_JornadaSiembra_v01.pdf", "pdf"],
  ["", "GEN_IRE_2026-S1_Presentacion_Resultados_v01", "gdoc"],
  ["", "GEN_IRE_2024-2026_MejorasYObrasCasa_v01", "gdoc"],
  ["", "Informe mensual enero 2025.pdf", "pdf", false, "md5-enero"],
  ["", "Copia de Informe mensual enero 2025.pdf", "pdf", false, "md5-enero"],
  ["", "informe mensual febrero 2025.pdf", "pdf"],
  ["", "Informe Mensual MARZO 2025 (1).pdf", "pdf"],
  ["", "Presentación resultados Q1 borrador.pptx", "pptx"],
  ["", "Plan de trabajo 2025", "gdoc"],
  ["", "Presupuesto general", "gsheet"],
  ["Facturas", "Factura_001_borrador.xlsx", "xlsx"],
  ["Facturas", "Factura_002_borrador.xlsx", "xlsx"],
  ["Facturas", "Factura_003_borrador.xlsx", "xlsx"],
  ["Facturas", "factura 004 BORRADOR.xlsx", "xlsx"],
  ["Facturas", "Resumen facturación 2025", "gsheet"],
  ["Fotos evento", "IMG_20250312_101522.jpg", "jpg", false, "md5-foto1"],
  ["Fotos evento", "IMG_20250312_101522 (1).jpg", "jpg", false, "md5-foto1"],
  ["Fotos evento", "IMG_20250312_101548.jpg", "jpg"],
  ["Fotos evento", "IMG_20250312_102011.jpg", "jpg"],
  ["Fotos evento", "IMG_20250312_102230.jpg", "jpg"],
  ["Fotos evento", "IMG_20250312_103105.jpg", "jpg"],
  ["Fotos evento", "WhatsApp Image 2025-03-12 at 10.41.22.jpeg", "jpg"],
  ["Fotos evento", "video resumen evento.mp4", "mp4"],
  ["Contratos", "Contrato prestación servicios - firmado.pdf", "pdf", true],
  ["Contratos", "contrato_servicios_v2_final_FINAL.docx", "docx"],
  ["Contratos", "Anexo técnico contrato.docx", "docx"],
  ["Contratos / 2024", "Contrato 2024 escaneado.pdf", "pdf", true],
  ["Contratos / 2024", "Anexo tecnico contrato.docx", "docx"],
  ["Logos", "logo-principal.png", "png"],
  ["Logos", "logo principal fondo blanco.png", "png"],
  ["Logos", "Logos todos los formatos.zip", "zip"],
]

/*
 * Árbol de carpetas de ejemplo. Las carpetas "s:<ruta>" apuntan a una parte
 * de SAMPLE, así que al abrirlas muestran esos archivos.
 */
const TOP: Record<string, FolderEntry[]> = {
  root: [
    { id: "s:", name: "Proyectos Cliente" },
    { id: "s:Fotos evento", name: "Fotos lanzamiento" },
    { id: "empty:docs", name: "Documentos personales" },
  ],
  "drive:comercial": [
    { id: "s:", name: "Proyectos Cliente" },
    { id: "s:Facturas", name: "Facturación 2025" },
  ],
  "drive:diseno": [
    { id: "s:Logos", name: "Logos" },
    { id: "s:Fotos evento", name: "Fotos" },
  ],
}

function buildFiles(): DriveFile[] {
  const base = Date.parse("2025-03-20T15:00:00Z")
  return SAMPLE.map(([path, name, type, locked, md5], i) => {
    const mimeType = MIME[type]
    return {
      id: `demo-${i}`,
      name,
      mimeType,
      kind: kindFromMime(mimeType),
      native: mimeType.startsWith("application/vnd.google-apps."),
      parentId: `folder:${path}`,
      path,
      modifiedTime: new Date(base - i * 1000 * 60 * 60 * 31).toISOString(),
      webViewLink: undefined,
      canRename: !locked,
      canTrash: !locked,
      // los archivos nativos de Google no tienen huella de contenido
      md5: mimeType.startsWith("application/vnd.google-apps.") ? undefined : (md5 ?? `md5-${i}`),
    }
  })
}

export function createDemoBackend(): DriveBackend {
  const files = buildFiles()
  /** Archivos enviados a la papelera en la demostración */
  const trashedIds = new Set<string>()
  /** La demostración simula dos cuentas para probar "Cambiar de cuenta" */
  let account = 0
  let catalogFile: CatalogFile | null = {
    id: "demo-catalogo",
    catalog: DEFAULT_CATALOG,
    canEdit: true,
    version: "1",
  }
  const ACCOUNTS = [
    { email: "demo@ejemplo.com", name: "Cuenta de demostración" },
    { email: "otra.cuenta@ejemplo.com", name: "Otra cuenta" },
  ]
  /** Administradores del catálogo de ejemplo (correos ficticios) */
  let admins: CatalogAdmin[] = [
    { permissionId: "p-owner", email: "demo@ejemplo.com", name: "Cuenta de demostración", kind: "owner" },
    { permissionId: "p-coord", email: "coordinacion@ejemplo.com", name: "Coordinación", kind: "editor" },
  ]
  const isAdmin = () => admins.some((a) => a.email === ACCOUNTS[account].email)

  return {
    demo: true,
    async restore() {
      return null
    },
    async signIn(selectAccount) {
      await wait(400)
      if (selectAccount) account = (account + 1) % ACCOUNTS.length
      return ACCOUNTS[account]
    },
    async signOut() {
      await wait(150)
    },
    async listItems(parentId) {
      await wait(250)
      if (parentId === "root" && account === 1)
        return [{ id: "s:Logos", name: "Carpeta de la otra cuenta" }]
      if (TOP[parentId]) return TOP[parentId]
      if (parentId.startsWith("s:")) {
        const prefix = parentId.slice(2)
        const names = new Set<string>()
        for (const [path] of SAMPLE) {
          const rest = prefix ? (path.startsWith(prefix + " / ") ? path.slice(prefix.length + 3) : null) : path
          if (rest) names.add(rest.split(" / ")[0])
        }
        const folders = [...names]
          .sort()
          .map((n) => ({ id: `s:${prefix ? `${prefix} / ` : ""}${n}`, name: n }))
        const here = files
          .filter((f) => f.path === prefix && !trashedIds.has(f.id))
          .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))
          .map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime }))
        return [...folders, ...here]
      }
      return []
    },
    async listSharedDrives() {
      await wait(300)
      return [
        { id: "drive:comercial", name: "Equipo Comercial" },
        { id: "drive:diseno", name: "Diseño y marca" },
      ]
    },
    async listSharedWithMe() {
      await wait(300)
      return [{ id: "s:Contratos", name: "Contratos cliente" }]
    },
    async scanFolder(id, onProgress) {
      const prefix = id.startsWith("s:") ? id.slice(2) : null
      const inside = files.filter(
        (f) =>
          !trashedIds.has(f.id) &&
          prefix !== null &&
          (!prefix || f.path === prefix || f.path.startsWith(prefix + " / "))
      )
      for (let i = 1; i <= 4; i++) {
        await wait(110)
        onProgress?.({ folders: i, files: Math.round((inside.length * i) / 4) })
      }
      const rebase = (p: string) =>
        !prefix ? p : p === prefix ? "" : p.slice(prefix.length + 3)
      return { files: inside.map((f) => ({ ...f, path: rebase(f.path) })), truncated: false }
    },
    async rename(id, newName) {
      await wait(120 + Math.random() * 180)
      const f = files.find((x) => x.id === id)
      if (!f) throw new Error("No se encontró o esta cuenta no tiene acceso.")
      if (!f.canRename)
        throw new Error("Esta cuenta no tiene permiso para hacer eso (se necesita permiso de edición).")
      f.name = newName
    },

    // Catálogo en memoria: la primera cuenta es administradora y la segunda no,
    // para poder probar los dos casos con "Cambiar de cuenta"
    async setTrashed(id, trashed) {
      await wait(150 + Math.random() * 150)
      const f = files.find((x) => x.id === id)
      if (!f) throw new Error("No se encontró o esta cuenta no tiene acceso.")
      if (!f.canTrash) throw new Error("Esta cuenta no tiene permiso para eliminar ese archivo.")
      if (trashed) trashedIds.add(id)
      else trashedIds.delete(id)
    },

    async loadCatalog() {
      await wait(200)
      if (!catalogFile) return null
      return { ...catalogFile, canEdit: isAdmin() }
    },
    async createCatalog(catalog) {
      await wait(400)
      catalogFile = { id: "demo-catalogo", catalog, canEdit: true, version: "1" }
      return catalogFile
    },
    async saveCatalog(file, catalog) {
      await wait(300)
      if (!catalogFile || file.version !== catalogFile.version) throw new CatalogConflictError()
      if (!isAdmin()) throw new Error("Tu cuenta no puede editar los códigos.")
      catalogFile = { ...catalogFile, catalog, version: String(Number(catalogFile.version) + 1) }
      return { ...catalogFile, canEdit: true }
    },
    async listAdmins() {
      await wait(200)
      return [...admins]
    },
    async addAdmin(_file, email) {
      await wait(300)
      const clean = email.trim().toLowerCase()
      if (!admins.some((a) => a.email === clean))
        admins = [...admins, { permissionId: `p-${clean}`, email: clean, kind: "editor" }]
    },
    async removeAdmin(_file, admin) {
      await wait(300)
      if (admin.kind === "owner") throw new Error("No se puede quitar a la propietaria del archivo.")
      admins = admins.filter((a) => a.permissionId !== admin.permissionId)
    },
  }
}
