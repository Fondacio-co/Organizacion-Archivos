import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Toaster } from "@/components/ui/sonner"
import { AppHeader } from "@/components/app-header"
import { AppNav, type View } from "@/components/app-nav"
import { FileBrowser, type KindFilter } from "@/components/file-browser"
import { FolderBar } from "@/components/folder-bar"
import { FolderExplorer, initialLocation, type ExplorerLocation } from "@/components/folder-explorer"
import { HistoryCard, type HistoryEntry } from "@/components/history-card"
import { APPLICABLE, RenamePanel } from "@/components/rename-panel"
import { SignInScreen } from "@/components/sign-in-screen"
import { createDemoBackend } from "@/lib/demo-drive"
import { createGoogleBackend, DriveError, SESSION_EXPIRED } from "@/lib/google-drive"
import { AdminsSection } from "@/components/admins-section"
import { CatalogEntryDialog, type EntryDialogState } from "@/components/catalog-entry-dialog"
import { ConfigPage, type CatalogStatus } from "@/components/config-page"
import {
  DEFAULT_CATALOG,
  removeEntry,
  upsertEntry,
  type Catalog,
  type CatalogEntry,
  type CatalogKind,
} from "@/lib/catalog"
import { complianceIssue, setCatalog } from "@/lib/nomenclature"
import { buildPreview, defaultRule, normalize, splitName, type RenameRule } from "@/lib/rename"
import {
  CatalogConflictError,
  type CatalogAdmin,
  type CatalogFile,
  type DriveFile,
  type FolderInfo,
  type RenameRequest,
  type RenameResult,
  type ScanProgress,
  type UserInfo,
} from "@/lib/types"

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const forceDemo = new URLSearchParams(location.search).has("demo")

/** Una sola conexión para toda la página (no se recrea al redibujar) */
const backend = CLIENT_ID && !forceDemo ? createGoogleBackend(CLIENT_ID) : createDemoBackend()

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" })

const recentKey = (email: string) => `renombrador:recientes:v2:${email}`
function loadRecent(email: string): FolderInfo[] {
  try {
    return JSON.parse(localStorage.getItem(recentKey(email)) ?? "[]")
  } catch {
    return []
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/* El historial se guarda en este navegador, por cuenta, para poder deshacer otro día */
const historyKey = (email: string) => `renombrador:historial:v1:${email}`
function loadHistory(email: string): HistoryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(historyKey(email)) ?? "[]") as (Omit<HistoryEntry, "at"> & { at: string })[]
    return raw.map((h) => ({ ...h, at: new Date(h.at) }))
  } catch {
    return []
  }
}

export default function App() {

  const [user, setUser] = useState<UserInfo | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  /** Mientras se revisa si ya había una sesión abierta (al recargar) */
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    backend
      .restore()
      .then((u) => {
        if (!u) return
        setUser(u)
        setRecent(loadRecent(u.email))
        setHistory(loadHistory(u.email))
      })
      .finally(() => setRestoring(false))
  }, [])
  const [recent, setRecent] = useState<FolderInfo[]>([])

  const [view, setView] = useState<View>("folders")
  const [explorer, setExplorer] = useState<ExplorerLocation>(initialLocation)
  const [folder, setFolder] = useState<FolderInfo | null>(null)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [truncated, setTruncated] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)

  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<KindFilter>("all")
  const [includeSubfolders, setIncludeSubfolders] = useState(true)
  const [onlyNonCompliant, setOnlyNonCompliant] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [rule, setRule] = useState<RenameRule>(defaultRule)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applying, setApplying] = useState<{ done: number; total: number } | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    if (user) localStorage.setItem(historyKey(user.email), JSON.stringify(history.slice(0, 50)))
  }, [history, user])

  /** Muestra un error; si la sesión se venció, ofrece volver a entrar con un clic */
  const showError = (e: unknown) => {
    if (e instanceof DriveError && e.status === 401) {
      toast.error(e.message, {
        duration: 15000,
        action: { label: "Volver a entrar", onClick: () => signIn() },
      })
    } else toast.error(message(e))
  }

  /* ---------- Catálogo de códigos (bloques y tipos), compartido en Drive ---------- */

  const [catalog, setCatalogState] = useState<Catalog>(DEFAULT_CATALOG)
  const [catalogFile, setCatalogFile] = useState<CatalogFile | null>(null)
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading")
  const [catalogError, setCatalogError] = useState<string>()
  const [entryDialog, setEntryDialog] = useState<EntryDialogState | null>(null)
  /** Si el formulario se abrió desde la pestaña Nomenclatura, el código creado queda elegido */
  const [entryFromNomen, setEntryFromNomen] = useState(false)

  /** Cambia el catálogo para las reglas de nombres y para la pantalla a la vez */
  const applyCatalog = (c: Catalog) => {
    setCatalog(c)
    setCatalogState(c)
  }

  const loadCatalog = useCallback(async () => {
    setCatalogStatus("loading")
    setCatalogError(undefined)
    try {
      const f = await backend.loadCatalog()
      setCatalogFile(f)
      applyCatalog(f?.catalog ?? DEFAULT_CATALOG)
      setCatalogStatus(!f ? "missing" : !f.catalog ? "damaged" : "ready")
    } catch (e) {
      // sin catálogo la página sigue funcionando con los códigos de fábrica
      applyCatalog(DEFAULT_CATALOG)
      setCatalogStatus("error")
      setCatalogError(message(e))
    }
  }, [])

  useEffect(() => {
    if (user) loadCatalog()
  }, [user?.email, loadCatalog])

  const createCatalogBase = async () => {
    const domain = user?.email.split("@")[1] ?? null
    const initial: Catalog = { ...catalog, updatedAt: new Date().toISOString(), updatedBy: user?.email }
    try {
      const f = await backend.createCatalog(initial, domain)
      setCatalogFile(f)
      applyCatalog(f.catalog ?? initial)
      setCatalogStatus("ready")
      toast.success("Base de códigos creada", {
        description: "Quedó en tu Drive y se compartió en solo lectura con toda la organización.",
      })
    } catch (e) {
      showError(e)
    }
  }

  /** Guarda el catálogo en Drive; devuelve false si no se pudo */
  const saveCatalog = async (next: Catalog, okMessage: string): Promise<boolean> => {
    if (!catalogFile) return false
    const stamped: Catalog = { ...next, updatedAt: new Date().toISOString(), updatedBy: user?.email }
    try {
      const f = await backend.saveCatalog(catalogFile, stamped)
      setCatalogFile(f)
      applyCatalog(stamped)
      toast.success(okMessage)
      return true
    } catch (e) {
      if (e instanceof CatalogConflictError)
        toast.error(e.message, { duration: 15000, action: { label: "Recargar", onClick: () => loadCatalog() } })
      else showError(e)
      return false
    }
  }

  const saveEntry = async (k: CatalogKind, entry: CatalogEntry, editing?: string) => {
    const name = k === "bloques" ? "Bloque" : "Tipo"
    const ok = await saveCatalog(
      upsertEntry(catalog, k, entry),
      editing ? `${name} ${entry.code} actualizado` : `${name} ${entry.code} creado`
    )
    if (!ok) return
    setEntryDialog(null)
    if (entryFromNomen && !editing) {
      // queda elegido en la pestaña Nomenclatura, que es desde donde se pidió
      setRule((r) => ({ ...r, nomen: { ...r.nomen, [k === "bloques" ? "bloque" : "tipo"]: entry.code } }))
    }
  }

  const deleteEntry = async (k: CatalogKind, code: string) => {
    const ok = await saveCatalog(removeEntry(catalog, k, code), `Se eliminó ${code}`)
    if (!ok) return
    const field = k === "bloques" ? "bloque" : "tipo"
    setRule((r) => (r.nomen[field] === code ? { ...r, nomen: { ...r.nomen, [field]: "" } } : r))
  }

  /* ---------- Administradores de los códigos ---------- */

  /** null = cargando; solo se consultan si la cuenta es administradora */
  const [admins, setAdmins] = useState<CatalogAdmin[] | null>(null)

  const loadAdmins = useCallback(async (f: CatalogFile) => {
    setAdmins(null)
    try {
      setAdmins(await backend.listAdmins(f))
    } catch (e) {
      setAdmins([])
      toast.error(`No se pudo leer la lista de administradores: ${message(e)}`)
    }
  }, [])

  useEffect(() => {
    if (catalogFile?.canEdit) loadAdmins(catalogFile)
    // solo cuando cambia el archivo o el permiso, no en cada guardado de códigos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogFile?.id, catalogFile?.canEdit, loadAdmins])

  const addAdmin = async (email: string): Promise<boolean> => {
    if (!catalogFile) return false
    try {
      await backend.addAdmin(catalogFile, email)
      toast.success(`${email} ahora es administrador`, { description: "Google le enviará un correo de aviso." })
      await loadAdmins(catalogFile)
      return true
    } catch (e) {
      showError(e)
      return false
    }
  }

  const removeAdmin = async (admin: CatalogAdmin) => {
    if (!catalogFile) return
    try {
      await backend.removeAdmin(catalogFile, admin)
      toast.success(`${admin.email} ya no es administrador`)
      await loadAdmins(catalogFile)
    } catch (e) {
      showError(e)
    }
  }

  const openEntryDialog = (k: CatalogKind, entry?: CatalogEntry, fromNomen = false) => {
    setEntryFromNomen(fromNomen)
    setEntryDialog({ kind: k, editing: entry })
  }

  /* ---------- Sesión ---------- */

  const resetWorkspace = () => {
    setView("folders")
    setExplorer(initialLocation())
    setFolder(null)
    setFiles([])
    setSelected(new Set())
    setQuery("")
    setRule(defaultRule)
    setHistory([])
  }

  const signIn = async (selectAccount = false) => {
    setSigningIn(true)
    try {
      const u = await backend.signIn(selectAccount)
      if (user && u.email !== user.email) resetWorkspace()
      setUser(u)
      setRecent(loadRecent(u.email))
      setHistory(loadHistory(u.email))
    } catch (e) {
      showError(e)
    } finally {
      setSigningIn(false)
    }
  }

  const signOut = async () => {
    await backend.signOut()
    setUser(null)
    resetWorkspace()
    applyCatalog(DEFAULT_CATALOG)
    setCatalogFile(null)
    setCatalogStatus("loading")
  }

  /* ---------- Carpeta ---------- */

  const scan = useCallback(
    async (f: FolderInfo) => {
      setScanning(true)
      setProgress({ folders: 0, files: 0 })
      try {
        const res = await backend.scanFolder(f.id, setProgress)
        const sorted = res.files.sort(
          (a, b) => collator.compare(a.path, b.path) || collator.compare(a.name, b.name)
        )
        setFiles(sorted)
        setTruncated(res.truncated)
        const ids = new Set(sorted.map((x) => x.id))
        setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))))
      } catch (e) {
        showError(e)
      } finally {
        setScanning(false)
      }
    },
    [backend]
  )

  const openFolder = async (f: FolderInfo) => {
    setView("rename")
    if (folder?.id === f.id && files.length) return
    setFolder(f)
    setFiles([])
    setSelected(new Set())
    setQuery("")
    if (user) {
      const next = [f, ...recent.filter((r) => r.id !== f.id)].slice(0, 5)
      setRecent(next)
      localStorage.setItem(recentKey(user.email), JSON.stringify(next))
    }
    await scan(f)
  }

  /* ---------- Búsqueda y selección ---------- */

  /** Archivos que no cumplen la nomenclatura → motivo en palabras simples */
  const issues = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of files) {
      const issue = complianceIssue(splitName(f).base)
      if (issue) m.set(f.id, issue)
    }
    return m
  }, [files, catalog]) // catalog: al crear o borrar un código cambia qué cumple

  const { visible, nonCompliantCount } = useMemo(() => {
    const q = normalize(query.trim())
    const base = files.filter(
      (f) =>
        (includeSubfolders || f.path === "") &&
        (kind === "all" || f.kind === kind) &&
        (!q || normalize(f.name).includes(q))
    )
    const pending = base.filter((f) => issues.has(f.id))
    return { visible: onlyNonCompliant ? pending : base, nonCompliantCount: pending.length }
  }, [files, query, kind, includeSubfolders, onlyNonCompliant, issues])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = (select: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const f of visible) {
        if (select) next.add(f.id)
        else next.delete(f.id)
      }
      return next
    })

  const selectedFiles = useMemo(() => files.filter((f) => selected.has(f.id)), [files, selected])
  const { items: preview, regexError } = useMemo(
    () => buildPreview(selectedFiles, files, rule),
    [selectedFiles, files, rule, catalog]
  )

  /* ---------- Renombrar ---------- */

  async function runRenames(requests: RenameRequest[]): Promise<RenameResult[]> {
    const results: RenameResult[] = []
    setApplying({ done: 0, total: requests.length })
    const queue = [...requests]
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        try {
          await backend.rename(r.id, r.newName)
          results.push({ ...r, ok: true })
        } catch (e) {
          results.push({ ...r, ok: false, error: message(e) })
        }
        setApplying({ done: results.length, total: requests.length })
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    const renamed = new Map(results.filter((r) => r.ok).map((r) => [r.id, r.newName]))
    setFiles((prev) => prev.map((f) => (renamed.has(f.id) ? { ...f, name: renamed.get(f.id)! } : f)))
    setApplying(null)
    return results
  }

  const applyRename = async () => {
    setConfirmOpen(false)
    const folderName = folder?.name ?? ""
    const requests = preview
      .filter((p) => APPLICABLE.includes(p.status))
      .map((p) => ({ id: p.file.id, oldName: p.file.name, newName: p.newName }))
    const results = await runRenames(requests)
    const ok = results.filter((r) => r.ok).length
    const failed = results.length - ok
    setHistory((h) => [
      { id: crypto.randomUUID(), at: new Date(), folderName, results, undone: false },
      ...h,
    ])
    setRule((r) => ({ ...r, manual: {}, nomen: { ...r.nomen, perFile: {} } }))
    if (failed === 0) {
      toast.success(`${ok} ${ok === 1 ? "archivo renombrado" : "archivos renombrados"}`)
      setSelected(new Set())
    } else {
      if (results.some((r) => r.error === SESSION_EXPIRED)) showError(new DriveError(SESSION_EXPIRED, 401))
      else toast.warning(`${ok} renombrados, ${failed} con error`, {
        description: results.find((r) => !r.ok)?.error,
      })
      // Deja seleccionados solo los que fallaron, para reintentar
      setSelected(new Set(results.filter((r) => !r.ok).map((r) => r.id)))
    }
  }

  const undo = async (entry: HistoryEntry) => {
    // Si alguien volvió a cambiar el nombre después, no se pisa ese cambio
    const current = new Map(files.map((f) => [f.id, f.name]))
    const ok = entry.results.filter((r) => r.ok)
    const changedSince = ok.filter((r) => current.has(r.id) && current.get(r.id) !== r.newName)
    const requests = ok
      .filter((r) => !changedSince.includes(r))
      .map((r) => ({ id: r.id, oldName: r.newName, newName: r.oldName }))
    const results = requests.length ? await runRenames(requests) : []
    const failed = results.filter((r) => !r.ok).length + changedSince.length
    setHistory((h) => h.map((e) => (e.id === entry.id ? { ...e, undone: true } : e)))
    if (changedSince.length)
      toast.warning(
        `${changedSince.length} ${changedSince.length === 1 ? "archivo no se restauró: lo volvieron" : "archivos no se restauraron: los volvieron"} a renombrar después`
      )
    else if (failed) toast.warning(`No se pudieron restaurar ${failed} archivos`)
    else toast.success("Cambios deshechos: los archivos recuperaron su nombre")
  }

  const applicable = preview.filter((p) => APPLICABLE.includes(p.status))
  const duplicates = applicable.filter((p) => p.status === "duplicate").length
  const skipped = preview.length - applicable.length
  // Por qué se omite cada archivo, en palabras simples
  const skippedReasons = (
    [
      ["incomplete", "les falta información"],
      ["empty", "quedarían sin nombre"],
      ["locked", "no tienes permiso para editarlos"],
      ["duplicate", "quedarían con un nombre repetido"],
      ["same", "ya están bien"],
      ["invalid", "el patrón no es válido"],
    ] as const
  )
    .map(([s, why]) => [preview.filter((p) => p.status === s).length, why] as const)
    .filter(([n]) => n > 0)
    .map(([n, why]) => `${n}: ${why}`)
    .join(" · ")

  /* ---------- Vista ---------- */

  return (
    <div className="min-h-screen">
      <AppHeader
        user={user}
        demo={backend.demo}
        onSwitchAccount={() => signIn(true)}
        onSignOut={signOut}
        nav={
          user && (
            <AppNav
              view={view}
              onView={setView}
              folderName={folder?.name}
              historyCount={history.filter((h) => !h.undone).length}
            />
          )
        }
      />

      {restoring ? (
        <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">Cargando…</div>
      ) : !user ? (
        <SignInScreen demo={backend.demo} loading={signingIn} onSignIn={() => signIn()} />
      ) : view === "settings" ? (
        <main className="px-4 py-8 sm:px-6 sm:py-10">
          <ConfigPage
            catalog={catalog}
            file={catalogFile}
            status={catalogStatus}
            errorText={catalogError}
            demo={backend.demo}
            onCreateBase={createCatalogBase}
            onEdit={(k, e) => openEntryDialog(k, e)}
            onDelete={deleteEntry}
            onReload={loadCatalog}
            adminsSection={
              user && (
                <AdminsSection
                  admins={admins}
                  currentEmail={user.email}
                  domain={backend.demo ? null : (user.email.split("@")[1] ?? null)}
                  onAdd={addAdmin}
                  onRemove={removeAdmin}
                />
              )
            }
          />
        </main>
      ) : view === "history" ? (
        <main className="mx-auto grid max-w-5xl gap-4 px-4 py-8 sm:px-6 sm:py-10">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
            <p className="text-sm text-muted-foreground">
              Los últimos cambios hechos con esta cuenta en este navegador. Puedes deshacer cada lote o descargar su registro.
            </p>
          </div>
          <HistoryCard entries={history} busy={!!applying} onUndo={undo} />
        </main>
      ) : view === "folders" || !folder ? (
        <main className="px-4 py-8 sm:px-6 sm:py-10">
          <FolderExplorer
            // Al cambiar de cuenta se monta de nuevo: así no quedan carpetas de la cuenta anterior
            key={user.email}
            backend={backend}
            location={explorer}
            onLocation={setExplorer}
            recent={recent}
            onOpen={openFolder}
            onReauth={() => signIn()}
          />
        </main>
      ) : (
        <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6">
          <FolderBar
            folder={folder}
            fileCount={files.length}
            scanning={scanning}
            progress={progress}
            onRefresh={() => scan(folder)}
            onChange={() => setView("folders")}
          />
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
            <FileBrowser
              loading={scanning}
              visible={visible}
              totalSelected={selected.size}
              hiddenSelected={selected.size - visible.filter((f) => selected.has(f.id)).length}
              selected={selected}
              query={query}
              kind={kind}
              includeSubfolders={includeSubfolders}
              truncated={truncated}
              issues={issues}
              nonCompliantCount={nonCompliantCount}
              onlyNonCompliant={onlyNonCompliant}
              onOnlyNonCompliant={setOnlyNonCompliant}
              onQuery={setQuery}
              onKind={setKind}
              onIncludeSubfolders={setIncludeSubfolders}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onClearSelection={() => setSelected(new Set())}
            />
            <RenamePanel
              rule={rule}
              onRule={setRule}
              preview={preview}
              regexError={regexError}
              applying={applying}
              onApply={() => setConfirmOpen(true)}
              catalog={catalog}
              canEditCatalog={!!catalogFile?.canEdit && catalogStatus === "ready"}
              onCreateCatalogEntry={(k) => openEntryDialog(k, undefined, true)}
            />
          </div>
        </main>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Renombrar {applicable.length} {applicable.length === 1 ? "archivo" : "archivos"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Los nombres se cambiarán directamente en Google Drive
              {folder ? ` (carpeta "${folder.name}")` : ""}. Si algo no queda bien, puedes
              deshacerlo desde el Historial.
              {duplicates > 0 && (
                <span className="mt-2 block text-warning">
                  {duplicates} {duplicates === 1 ? "quedará" : "quedarán"} con un nombre repetido en
                  su carpeta.
                </span>
              )}
              {skipped > 0 && (
                <span className="mt-2 block">
                  {skipped} {skipped === 1 ? "archivo no se tocará" : "archivos no se tocarán"} ({skippedReasons}).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyRename}>Sí, renombrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CatalogEntryDialog
        state={entryDialog}
        catalog={catalog}
        onClose={() => setEntryDialog(null)}
        onSave={saveEntry}
      />

      <Toaster position="bottom-right" richColors={false} />
    </div>
  )
}
