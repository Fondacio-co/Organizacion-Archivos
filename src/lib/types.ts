import type { Catalog } from "./catalog"

export type FileKind =
  | "folder"
  | "doc"
  | "sheet"
  | "slides"
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "zip"
  | "other"

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  kind: FileKind
  /** true para archivos nativos de Google (Docs, Hojas…), que no llevan extensión */
  native: boolean
  parentId: string
  /** Ruta relativa a la carpeta conectada ("" = directamente en la carpeta) */
  path: string
  modifiedTime: string
  webViewLink?: string
  canRename: boolean
}

export interface FolderInfo {
  id: string
  name: string
  /** Nombre de la unidad compartida, si la carpeta está en una */
  sharedDriveName?: string
  webViewLink?: string
  /** Ruta legible, ej. "Unidades compartidas / Comercial / Clientes" */
  location?: string
}

export interface FolderEntry {
  id: string
  name: string
  /** Solo viene en los listados del explorador; si falta, es una carpeta o unidad */
  mimeType?: string
  modifiedTime?: string
  webViewLink?: string
}

export const FOLDER_MIME = "application/vnd.google-apps.folder"
export const isFolder = (e: FolderEntry) => !e.mimeType || e.mimeType === FOLDER_MIME

export interface UserInfo {
  email: string
  name?: string
  picture?: string
}

export interface ScanProgress {
  folders: number
  files: number
}

export interface ScanResult {
  files: DriveFile[]
  truncated: boolean
}

export interface RenameRequest {
  id: string
  oldName: string
  newName: string
}

export interface RenameResult extends RenameRequest {
  ok: boolean
  error?: string
}

/** El archivo .json del catálogo de códigos en Drive */
export interface CatalogFile {
  id: string
  /** null si el archivo existe pero está dañado */
  catalog: Catalog | null
  /** true = esta cuenta puede editarlo (es administradora) */
  canEdit: boolean
  /** Versión de Drive: sirve para detectar si otra persona lo cambió */
  version: string
  webViewLink?: string
}

/** Una persona con permiso de edición sobre el .json (administradora) */
export interface CatalogAdmin {
  /** Id del permiso en Drive (para quitarlo) */
  permissionId: string
  email: string
  name?: string
  /** owner = propietaria del archivo; inherited = viene de la unidad compartida (no se quita aquí) */
  kind: "owner" | "editor" | "inherited"
}

/** Otra persona guardó el catálogo mientras tú lo editabas */
export class CatalogConflictError extends Error {
  constructor() {
    super("Otro administrador cambió los códigos mientras editabas. Recarga para ver la versión más reciente.")
  }
}

/** Lo que la interfaz necesita de Drive; hay una versión real y una de demostración. */
export interface DriveBackend {
  demo: boolean
  /** Recupera la sesión si el permiso de Google sigue vigente (al recargar la página) */
  restore(): Promise<UserInfo | null>
  signIn(selectAccount?: boolean): Promise<UserInfo>
  signOut(): Promise<void>
  /** Carpetas y archivos dentro de una carpeta, carpetas primero ("root" = Mi unidad; también sirve con el ID de una unidad compartida) */
  listItems(parentId: string): Promise<FolderEntry[]>
  listSharedDrives(): Promise<FolderEntry[]>
  /** Carpetas y archivos que otras personas compartieron con esta cuenta */
  listSharedWithMe(): Promise<FolderEntry[]>
  scanFolder(
    folderId: string,
    onProgress?: (p: ScanProgress) => void
  ): Promise<ScanResult>
  rename(id: string, newName: string): Promise<void>
  /** Busca el .json del catálogo (null si todavía no existe) */
  loadCatalog(): Promise<CatalogFile | null>
  /** Crea el .json y lo comparte en solo lectura con el dominio de la cuenta */
  createCatalog(catalog: Catalog, domain: string | null): Promise<CatalogFile>
  /** Guarda cambios; falla con CatalogConflictError si otra persona lo cambió antes */
  saveCatalog(file: CatalogFile, catalog: Catalog): Promise<CatalogFile>
  /** Quiénes pueden editar el .json (solo lo pueden consultar los administradores) */
  listAdmins(file: CatalogFile): Promise<CatalogAdmin[]>
  /** Comparte el .json como Editor con ese correo y le avisa por correo */
  addAdmin(file: CatalogFile, email: string): Promise<void>
  /** Le quita el permiso de edición (vuelve a solo lectura por el dominio) */
  removeAdmin(file: CatalogFile, admin: CatalogAdmin): Promise<void>
}

export function kindFromMime(mime: string): FileKind {
  if (mime === "application/vnd.google-apps.folder") return "folder"
  if (mime === "application/pdf") return "pdf"
  if (
    mime === "application/vnd.google-apps.document" ||
    mime.includes("wordprocessingml") ||
    mime === "application/msword" ||
    mime === "application/rtf" ||
    mime.startsWith("text/plain") ||
    mime === "application/vnd.oasis.opendocument.text"
  )
    return "doc"
  if (
    mime === "application/vnd.google-apps.spreadsheet" ||
    mime.includes("spreadsheetml") ||
    mime === "application/vnd.ms-excel" ||
    mime === "text/csv" ||
    mime === "application/vnd.oasis.opendocument.spreadsheet"
  )
    return "sheet"
  if (
    mime === "application/vnd.google-apps.presentation" ||
    mime.includes("presentationml") ||
    mime === "application/vnd.ms-powerpoint"
  )
    return "slides"
  if (mime.startsWith("image/") || mime === "application/vnd.google-apps.drawing")
    return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (/zip|rar|7z|tar|gzip/.test(mime)) return "zip"
  return "other"
}
