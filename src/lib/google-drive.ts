import {
  kindFromMime,
  type DriveBackend,
  type DriveFile,
  type FolderEntry,
  type ScanResult,
  type UserInfo,
} from "./types"

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
    const res = await fetch(`${API}${path}`, {
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
