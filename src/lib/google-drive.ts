import { DEFAULT_ADMINS, parseCatalog, type Catalog } from "./catalog"
import {
  CatalogConflictError,
  kindFromMime,
  type CatalogFile,
  type DriveBackend,
  type DriveFile,
  type FolderEntry,
  type ScanResult,
  type UserInfo,
} from "./types"

const UPLOAD = "https://www.googleapis.com/upload/drive/v3"
/** Marca invisible que identifica el .json del catálogo, aunque lo muevan o renombren */
const CATALOG_PROP = "organizacionArchivosCatalogo"
const CATALOG_NAME = "Organizacion de Archivos - codigos.json"
const CATALOG_FIELDS = "id,version,webViewLink,capabilities/canEdit"
/** Dominios públicos con los que no tiene sentido compartir "con toda la organización" */
const PUBLIC_DOMAINS = new Set(["gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "yahoo.com"])

interface RawCatalogFile {
  id: string
  version: string
  webViewLink?: string
  capabilities?: { canEdit?: boolean }
}

/*
 * Conexión real con Google: inicio de sesión con Google Identity Services
 * (ventana emergente de Google) y llamadas directas a la API de Drive v3.
 * El token vive solo en memoria del navegador; no hay servidor propio.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "openid",
  "email",
  "profile",
].join(" ")

const API = "https://www.googleapis.com/drive/v3"
const FOLDER_MIME = "application/vnd.google-apps.folder"
/** Tope de archivos por carpeta para no colgar el navegador */
export const MAX_FILES = 5000

interface TokenResponse {
  access_token: string
  expires_in: number
  error?: string
  error_description?: string
}

interface TokenClient {
  callback: (r: TokenResponse) => void
  error_callback?: (e: { type: string; message?: string }) => void
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type: string; message?: string }) => void
          }): TokenClient
          revoke(token: string, done?: () => void): void
        }
      }
    }
  }
}

export const SESSION_EXPIRED =
  "Tu sesión de Google se venció (por seguridad dura más o menos una hora)."

export class DriveError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let gisPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = "https://accounts.google.com/gsi/client"
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      gisPromise = null
      reject(new Error("No se pudo cargar el inicio de sesión de Google. Revisa tu conexión."))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

/*
 * El permiso de Google (token) se guarda en sessionStorage: dura lo que la pestaña
 * esté abierta y máximo ~1 hora. Así recargar la página no vuelve a pedir la cuenta.
 */
const SESSION_KEY = "renombrador:sesion-google"

interface StoredSession {
  token: string
  expires: number
  user: UserInfo
}

function loadSession(): StoredSession | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as StoredSession | null
    return s && s.expires > Date.now() ? s : null
  } catch {
    return null
  }
}

export function createGoogleBackend(clientId: string): DriveBackend {
  const saved = loadSession()
  let client: TokenClient | null = null
  let token: string | null = saved?.token ?? null
  let tokenExpires = saved?.expires ?? 0
  let user: UserInfo | null = saved?.user ?? null
  let hint: string | undefined = saved?.user.email
  /** Si ya hay una ventana de Google abierta, las demás consultas esperan esa misma */
  let pending: Promise<string> | null = null

  function persist() {
    if (token && user) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expires: tokenExpires, user }))
    }
  }

  function requestToken(prompt: string): Promise<string> {
    pending ??= doRequestToken(prompt).finally(() => {
      pending = null
    })
    return pending
  }

  async function doRequestToken(prompt: string): Promise<string> {
    await loadGis()
    if (!client) {
      client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: () => {},
      })
    }
    const c = client
    return new Promise<string>((resolve, reject) => {
      c.callback = (r) => {
        if (r.error || !r.access_token) {
          reject(new Error(r.error_description || "No se concedió el acceso a Google Drive."))
          return
        }
        token = r.access_token
        tokenExpires = Date.now() + ((Number(r.expires_in) || 3600) - 60) * 1000
        persist()
        resolve(r.access_token)
      }
      c.error_callback = (e) => {
        reject(
          new Error(
            e.type === "popup_closed"
              ? "Se cerró la ventana de Google antes de terminar."
              : e.type === "popup_failed_to_open"
                ? "El navegador bloqueó la ventana de Google. Permite ventanas emergentes para esta página."
                : e.message || "No se pudo iniciar sesión con Google."
          )
        )
      }
      // Al cambiar de cuenta no se sugiere la anterior: Google muestra el selector completo
      c.requestAccessToken(prompt === "select_account" ? { prompt } : { prompt, login_hint: hint })
    })
  }

  async function getToken(): Promise<string> {
    if (token && Date.now() < tokenExpires) return token
    try {
      return await requestToken("")
    } catch {
      // Google da un permiso que dura ~1 hora; renovarlo necesita un clic del usuario
      throw new DriveError(SESSION_EXPIRED, 401)
    }
  }

  async function api<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
    const t = await getToken()
    // las rutas que empiezan por http son de subida de contenido (upload/drive/v3)
    const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${t}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    })
    if (res.status === 401 && retry) {
      token = null
      return api<T>(path, init, false)
    }
    if (!res.ok) {
      let reason = ""
      let message = ""
      try {
        const body = await res.json()
        reason = body?.error?.errors?.[0]?.reason ?? ""
        message = body?.error?.message ?? ""
      } catch {
        /* sin cuerpo */
      }
      throw new DriveError(friendlyError(res.status, reason, message), res.status)
    }
    if (res.status === 204) return undefined as T // DELETE no devuelve contenido
    return res.json() as Promise<T>
  }

  /** Lista carpetas y archivos que cumplen una consulta (carpetas primero), recorriendo todas las páginas */
  async function listAll(q: string, corpora: "allDrives" | "user"): Promise<FolderEntry[]> {
    const out: FolderEntry[] = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({
        q,
        corpora,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        orderBy: "folder,name_natural",
        pageSize: "1000",
        fields: "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)",
      })
      if (pageToken) params.set("pageToken", pageToken)
      const page = await api<{ nextPageToken?: string; files: FolderEntry[] }>(`/files?${params}`)
      out.push(...page.files)
      pageToken = page.nextPageToken
    } while (pageToken)
    return out
  }

  return {
    demo: false,

    async restore() {
      return token && user && Date.now() < tokenExpires ? user : null
    },

    async signIn(selectAccount = false) {
      const t = await requestToken(selectAccount ? "select_account" : "")
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${t}` },
      })
      const info = (await res.json()) as UserInfo
      hint = info.email
      user = { email: info.email, name: info.name, picture: info.picture }
      persist()
      return user
    },

    async signOut() {
      if (token) {
        const t = token
        await new Promise<void>((r) => window.google?.accounts.oauth2.revoke(t, () => r()) ?? r())
      }
      token = null
      user = null
      hint = undefined
      sessionStorage.removeItem(SESSION_KEY)
    },

    listItems(parentId) {
      return listAll(`'${parentId}' in parents and trashed = false`, "allDrives")
    },

    listSharedWithMe() {
      return listAll(`sharedWithMe = true and trashed = false`, "user")
    },

    async listSharedDrives() {
      const out: FolderEntry[] = []
      let pageToken: string | undefined
      do {
        const params = new URLSearchParams({ pageSize: "100", fields: "nextPageToken,drives(id,name)" })
        if (pageToken) params.set("pageToken", pageToken)
        const page = await api<{ nextPageToken?: string; drives?: FolderEntry[] }>(`/drives?${params}`)
        out.push(...(page.drives ?? []))
        pageToken = page.nextPageToken
      } while (pageToken)
      return out.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))
    },

    async scanFolder(folderId, onProgress): Promise<ScanResult> {
      const files: DriveFile[] = []
      const queue: { id: string; path: string }[] = [{ id: folderId, path: "" }]
      let folders = 0
      let truncated = false

      async function listChildren(folder: { id: string; path: string }) {
        let pageToken: string | undefined
        do {
          const params = new URLSearchParams({
            q: `'${folder.id}' in parents and trashed = false`,
            corpora: "allDrives",
            supportsAllDrives: "true",
            includeItemsFromAllDrives: "true",
            pageSize: "1000",
            fields:
              "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,capabilities/canRename)",
          })
          if (pageToken) params.set("pageToken", pageToken)
          const page = await api<{
            nextPageToken?: string
            files: {
              id: string
              name: string
              mimeType: string
              modifiedTime: string
              webViewLink?: string
              capabilities?: { canRename?: boolean }
            }[]
          }>(`/files?${params}`)
          for (const f of page.files) {
            if (f.mimeType === FOLDER_MIME) {
              queue.push({ id: f.id, path: folder.path ? `${folder.path} / ${f.name}` : f.name })
              continue
            }
            if (files.length >= MAX_FILES) {
              truncated = true
              return
            }
            files.push({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              kind: kindFromMime(f.mimeType),
              native: f.mimeType.startsWith("application/vnd.google-apps."),
              parentId: folder.id,
              path: folder.path,
              modifiedTime: f.modifiedTime,
              webViewLink: f.webViewLink,
              canRename: f.capabilities?.canRename ?? true,
            })
          }
          pageToken = page.nextPageToken
        } while (pageToken)
        folders++
        onProgress?.({ folders, files: files.length })
      }

      // Recorre las subcarpetas de 4 en 4 para ir rápido sin saturar la API
      while (queue.length && !truncated) {
        const batch = queue.splice(0, 4)
        await Promise.all(batch.map(listChildren))
      }
      return { files, truncated }
    },

    async rename(id, newName) {
      await api(`/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name`, {
        method: "PATCH",
        body: JSON.stringify({ name: newName }),
      })
    },

    async loadCatalog() {
      const raw = await findCatalogFile()
      if (!raw) return null
      const content = await api<unknown>(
        `/files/${encodeURIComponent(raw.id)}?alt=media&supportsAllDrives=true`
      ).catch(() => null)
      return toCatalogFile(raw, parseCatalog(content))
    },

    async createCatalog(catalog, domain) {
      const boundary = `orgarch${Math.random().toString(36).slice(2)}`
      const meta = {
        name: CATALOG_NAME,
        mimeType: "application/json",
        appProperties: { [CATALOG_PROP]: "1" },
        description:
          "Códigos de bloque y tipo de la herramienta Organización de Archivos. Edítalos desde la pestaña Configuración de la herramienta, no a mano. Quien puede editar este archivo es administrador.",
      }
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(catalog, null, 2)}\r\n` +
        `--${boundary}--`
      const raw = await api<RawCatalogFile>(
        `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=${CATALOG_FIELDS}`,
        { method: "POST", body, headers: { "Content-Type": `multipart/related; boundary=${boundary}` } }
      )
      // Todos los de la organización lo pueden leer (y encontrar); solo los editores lo cambian
      if (domain && !PUBLIC_DOMAINS.has(domain)) {
        await api(
          `/files/${encodeURIComponent(raw.id)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
          {
            method: "POST",
            body: JSON.stringify({ type: "domain", role: "reader", domain, allowFileDiscovery: true }),
          }
        ).catch(() => {
          /* si el dominio no permite compartir así, el administrador lo comparte a mano */
        })
      }
      // Administradores por defecto (además de quien la crea)
      for (const email of DEFAULT_ADMINS) {
        if (email.toLowerCase() === user?.email.toLowerCase()) continue
        await shareAsEditor(raw.id, email).catch(() => {
          /* si falla (ej. el correo no existe), se puede agregar luego desde Configuración */
        })
      }
      const fresh = await api<RawCatalogFile>(
        `/files/${encodeURIComponent(raw.id)}?supportsAllDrives=true&fields=${CATALOG_FIELDS}`
      )
      return toCatalogFile(fresh, catalog)
    },

    async saveCatalog(file, catalog) {
      // Antes de guardar se revisa que nadie lo haya cambiado desde que se leyó
      const current = await api<RawCatalogFile>(
        `/files/${encodeURIComponent(file.id)}?supportsAllDrives=true&fields=${CATALOG_FIELDS}`
      )
      if (current.version !== file.version) throw new CatalogConflictError()
      if (!current.capabilities?.canEdit)
        throw new Error("Tu cuenta no puede editar los códigos. Pide a un administrador que te comparta el archivo como Editor.")
      const raw = await api<RawCatalogFile>(
        `${UPLOAD}/files/${encodeURIComponent(file.id)}?uploadType=media&supportsAllDrives=true&fields=${CATALOG_FIELDS}`,
        {
          method: "PATCH",
          body: JSON.stringify(catalog, null, 2),
          headers: { "Content-Type": "application/json; charset=UTF-8" },
        }
      )
      return toCatalogFile(raw, catalog)
    },

    async listAdmins(file) {
      const res = await api<{
        permissions: {
          id: string
          type: string
          role: string
          emailAddress?: string
          displayName?: string
          permissionDetails?: { inherited?: boolean }[]
        }[]
      }>(
        `/files/${encodeURIComponent(file.id)}/permissions?supportsAllDrives=true&fields=permissions(id,type,role,emailAddress,displayName,permissionDetails(inherited))`
      )
      const EDIT_ROLES = new Set(["owner", "organizer", "fileOrganizer", "writer"])
      return res.permissions
        .filter((p) => (p.type === "user" || p.type === "group") && p.emailAddress && EDIT_ROLES.has(p.role))
        .map((p) => ({
          permissionId: p.id,
          email: p.emailAddress!,
          name: p.displayName,
          kind:
            p.role === "owner"
              ? ("owner" as const)
              : p.permissionDetails?.length && p.permissionDetails.every((d) => d.inherited)
                ? ("inherited" as const)
                : ("editor" as const),
        }))
        .sort((a, b) => a.email.localeCompare(b.email))
    },

    async addAdmin(file, email) {
      await shareAsEditor(file.id, email.trim().toLowerCase())
    },

    async removeAdmin(file, admin) {
      if (admin.kind !== "editor")
        throw new Error(
          admin.kind === "owner"
            ? "No se puede quitar a la propietaria del archivo."
            : "Este permiso viene de la unidad compartida: quítalo desde los miembros de la unidad en Drive."
        )
      await api(
        `/files/${encodeURIComponent(file.id)}/permissions/${encodeURIComponent(admin.permissionId)}?supportsAllDrives=true`,
        { method: "DELETE" }
      )
    },
  }

  /** Comparte el .json como Editor y le avisa por correo a la persona */
  async function shareAsEditor(fileId: string, email: string) {
    const params = new URLSearchParams({
      supportsAllDrives: "true",
      sendNotificationEmail: "true",
      emailMessage:
        "Ahora eres administrador(a) de los códigos de bloque y tipo de la herramienta Organización de Archivos (https://organizacion-archivos.vercel.app). Puedes gestionarlos en la pestaña Configuración.",
    })
    await api(`/files/${encodeURIComponent(fileId)}/permissions?${params}`, {
      method: "POST",
      body: JSON.stringify({ type: "user", role: "writer", emailAddress: email }),
    })
  }

  /**
   * Busca el .json por su marca: primero en lo que la cuenta ve (Mi unidad, compartido
   * y unidades compartidas) y luego en lo compartido con toda la organización.
   * Si hubiera varios, usa el más antiguo (el original).
   */
  async function findCatalogFile(): Promise<RawCatalogFile | null> {
    for (const corpora of ["allDrives", "domain"]) {
      const params = new URLSearchParams({
        q: `appProperties has { key='${CATALOG_PROP}' and value='1' } and trashed = false`,
        corpora,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        orderBy: "createdTime",
        pageSize: "10",
        fields: `files(${CATALOG_FIELDS})`,
      })
      try {
        const res = await api<{ files: RawCatalogFile[] }>(`/files?${params}`)
        if (res.files?.length) return res.files[0]
      } catch (e) {
        if (corpora === "allDrives") throw e
        // "domain" no existe para cuentas personales: se ignora
      }
    }
    return null
  }
}

function friendlyError(status: number, reason: string, message: string): string {
  if (status === 404) return "No se encontró o esta cuenta no tiene acceso."
  if (status === 403) {
    if (/rateLimit|userRateLimitExceeded/i.test(reason))
      return "Google está limitando las solicitudes. Espera un momento e inténtalo de nuevo."
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason + message))
      return "La API de Google Drive no está activada en el proyecto de Google Cloud."
    return "Esta cuenta no tiene permiso para hacer eso (se necesita permiso de edición)."
  }
  if (status === 401) return SESSION_EXPIRED
  if (status >= 500) return "Google Drive no respondió. Inténtalo de nuevo en un momento."
  return message || `Error de Google Drive (${status}).`
}

function toCatalogFile(raw: RawCatalogFile, catalog: Catalog | null): CatalogFile {
  return {
    id: raw.id,
    catalog,
    canEdit: !!raw.capabilities?.canEdit,
    version: String(raw.version),
    webViewLink: raw.webViewLink,
  }
}
