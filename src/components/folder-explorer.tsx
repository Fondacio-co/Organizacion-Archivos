import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  ChevronRightIcon,
  ClockIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderXIcon,
  HardDriveIcon,
  SearchIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { normalize } from "@/lib/rename"
import { isFolder, kindFromMime, type DriveBackend, type FolderEntry, type FolderInfo } from "@/lib/types"
import { FileKindIcon } from "./file-kind-icon"

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" })

export type Section = "my" | "shared" | "withMe"

export interface ExplorerLocation {
  section: Section
  /** Carpetas abiertas, de la más externa a la actual */
  trail: FolderEntry[]
}

const SECTIONS: Record<Section, { label: string; icon: LucideIcon; tone: string; empty: string }> = {
  my: {
    label: "Mi unidad",
    icon: HardDriveIcon,
    tone: "text-primary",
    empty: "Esta carpeta no tiene subcarpetas.",
  },
  shared: {
    label: "Unidades compartidas",
    icon: UsersIcon,
    tone: "text-brand-teal",
    empty: "Esta cuenta no pertenece a ninguna unidad compartida.",
  },
  withMe: {
    label: "Compartido conmigo",
    icon: UserPlusIcon,
    tone: "text-brand-orange",
    empty: "Nadie ha compartido carpetas con esta cuenta.",
  },
}

export const initialLocation = (): ExplorerLocation => ({
  section: "my",
  trail: [{ id: "root", name: "Mi unidad" }],
})

function baseTrail(section: Section): FolderEntry[] {
  return section === "my" ? [{ id: "root", name: "Mi unidad" }] : []
}

export function FolderExplorer({
  backend,
  location,
  onLocation,
  recent,
  onOpen,
  onReauth,
}: {
  onReauth: () => Promise<void>
  backend: DriveBackend
  location: ExplorerLocation
  onLocation: (l: ExplorerLocation) => void
  recent: FolderInfo[]
  onOpen: (f: FolderInfo) => void
}) {
  const { section, trail } = location
  const current = trail.at(-1)
  const key = `${section}:${current?.id ?? "_"}`

  const cache = useRef(new Map<string, FolderEntry[]>())
  const [items, setItems] = useState<FolderEntry[] | null>(cache.current.get(key) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [reload, setReload] = useState(0)
  const [guideSeen, setGuideSeen] = useState(() => localStorage.getItem(GUIDE_KEY) === "1")

  useEffect(() => {
    let cancelled = false
    setFilter("")
    setError(null)
    const cached = cache.current.get(key)
    setItems(cached ?? null)
    const load = current
      ? backend.listItems(current.id)
      : section === "shared"
        ? backend.listSharedDrives()
        : backend.listSharedWithMe()
    load
      .then((list) => {
        cache.current.set(key, list)
        if (!cancelled) setItems(list)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [key, reload])

  const go = (next: ExplorerLocation) => onLocation(next)
  const enter = (f: FolderEntry) => go({ section, trail: [...trail, f] })

  const toInfo = (path: FolderEntry[]): FolderInfo => {
    const last = path.at(-1)!
    const isRoot = last.id === "root"
    const crumbs = [
      ...(section === "my" ? [] : [SECTIONS[section].label]),
      ...path.map((p) => p.name),
    ]
    return {
      id: last.id,
      name: last.name,
      sharedDriveName: section === "shared" ? path[0]?.name : undefined,
      location: crumbs.join(" / "),
      webViewLink: backend.demo
        ? undefined
        : isRoot
          ? "https://drive.google.com/drive/my-drive"
          : `https://drive.google.com/drive/folders/${last.id}`,
    }
  }

  const q = normalize(filter.trim())
  const shown = (items ?? []).filter((f) => !q || normalize(f.name).includes(q))
  const isDriveList = section === "shared" && !current
  const folderCount = (items ?? []).filter(isFolder).length
  const fileCount = (items?.length ?? 0) - folderCount

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Tus carpetas</h1>
        <p className="text-sm text-muted-foreground">
          Entra a la carpeta que quieres ordenar y pulsa{" "}
          <span className="font-medium text-foreground">Ordenar esta carpeta</span>.
        </p>
      </div>

      {!guideSeen && (
        <Guide
          onClose={() => {
            localStorage.setItem(GUIDE_KEY, "1")
            setGuideSeen(true)
          }}
        />
      )}

      <div className="grid overflow-hidden rounded-xl border bg-white md:grid-cols-[232px_minmax(0,1fr)]">
        {/* Navegación */}
        <nav className="flex min-w-0 flex-col gap-5 border-b bg-muted/40 p-3 md:border-r md:border-b-0">
          <div className="grid gap-0.5">
            {(Object.keys(SECTIONS) as Section[]).map((s) => {
              const { label, icon: Icon, tone } = SECTIONS[s]
              const active = s === section
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => go({ section: s, trail: baseTrail(s) })}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    active ? "bg-white font-medium shadow-sm ring-1 ring-border" : "hover:bg-white/70"
                  )}
                >
                  <Icon className={cn("size-4", tone)} />
                  {label}
                </button>
              )
            })}
          </div>
          {recent.length > 0 && (
            <div className="hidden min-w-0 md:block">
              <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <ClockIcon className="size-3" />
                Recientes
              </p>
              <div className="grid min-w-0 gap-0.5">
                {recent.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onOpen(f)}
                    title={f.location ?? f.name}
                    className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-white/70"
                  >
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Contenido */}
        <div className="flex min-h-[440px] min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <Breadcrumb>
              <Crumb onClick={trail.length > baseTrail(section).length ? () => go({ section, trail: baseTrail(section) }) : undefined}>
                {SECTIONS[section].label}
              </Crumb>
              {trail.slice(section === "my" ? 1 : 0).map((t, i, arr) => {
                const idx = (section === "my" ? 1 : 0) + i
                const last = i === arr.length - 1
                return (
                  <Crumb
                    key={t.id + idx}
                    onClick={last ? undefined : () => go({ section, trail: trail.slice(0, idx + 1) })}
                  >
                    {t.name}
                  </Crumb>
                )
              })}
            </Breadcrumb>
            {current && (
              <Button className="ml-auto" onClick={() => onOpen(toInfo(trail))}>
                <FolderOpenIcon />
                Ordenar esta carpeta
              </Button>
            )}
          </div>

          {(items?.length ?? 0) > 8 && (
            <div className="relative border-b px-4 py-2.5">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrar por nombre…"
                className="h-9 pl-9"
              />
            </div>
          )}

          {items && items.length > 0 && current && (
            <p className="border-b px-5 py-2 text-xs text-muted-foreground">
              {folderCount} {folderCount === 1 ? "carpeta" : "carpetas"} · {fileCount}{" "}
              {fileCount === 1 ? "archivo" : "archivos"}
            </p>
          )}

          <div className="flex-1 overflow-y-auto">
            {error ? (
              <EmptyState icon={FolderXIcon} title="No se pudieron cargar las carpetas" text={error}>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={async () => {
                    await onReauth()
                    cache.current.delete(key)
                    setReload((n) => n + 1)
                  }}
                >
                  Volver a intentar
                </Button>
              </EmptyState>
            ) : items === null ? (
              <div className="grid gap-1 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="size-9 rounded-lg" />
                    <Skeleton className="h-3.5" style={{ width: `${30 + ((i * 29) % 40)}%` }} />
                  </div>
                ))}
              </div>
            ) : shown.length === 0 ? (
              <EmptyState
                icon={FolderIcon}
                title={q ? "Nada coincide" : current ? "Carpeta vacía" : "Sin elementos"}
                text={
                  q
                    ? "Prueba con otro nombre."
                    : current
                      ? "Esta carpeta no tiene archivos ni subcarpetas."
                      : SECTIONS[section].empty
                }
              />
            ) : (
              <ul className="grid gap-0.5 p-2">
                {shown.map((f) =>
                  !isFolder(f) ? (
                    <li key={f.id}>
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => !f.webViewLink && e.preventDefault()}
                        title={f.webViewLink ? "Abrir en Google Drive" : f.name}
                        className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted"
                      >
                        <FileKindIcon kind={kindFromMime(f.mimeType!)} className="size-9" />
                        <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                        {f.modifiedTime && (
                          <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:block">
                            {dateFmt.format(new Date(f.modifiedTime))}
                          </span>
                        )}
                        <ExternalLinkIcon
                          className={cn(
                            "size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100",
                            !f.webViewLink && "invisible"
                          )}
                        />
                      </a>
                    </li>
                  ) : (
                  <li key={f.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => enter(f)}
                      onKeyDown={(e) => e.key === "Enter" && enter(f)}
                      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors outline-none hover:bg-secondary/60 focus-visible:bg-secondary"
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-lg",
                          isDriveList ? "bg-success-soft text-success" : "bg-secondary text-primary"
                        )}
                      >
                        {isDriveList ? <UsersIcon className="size-[18px]" /> : <FolderIcon className="size-[18px]" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpen(toInfo([...trail, f]))
                        }}
                      >
                        Ordenar
                      </Button>
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    </div>
                  </li>
                  )
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Breadcrumb({ children }: { children: ReactNode }) {
  return <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">{children}</ol>
}

function Crumb({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <li className="flex min-w-0 items-center gap-1 [&:not(:first-child)]:before:text-muted-foreground [&:not(:first-child)]:before:content-['/']">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="truncate rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {children}
        </button>
      ) : (
        <span className="truncate px-1 font-semibold">{children}</span>
      )}
    </li>
  )
}

function EmptyState({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon
  title: string
  text: string
  children?: ReactNode
}) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  )
}

const GUIDE_KEY = "renombrador:guia-vista"

const GUIDE_STEPS = [
  { title: "Elige una carpeta", text: "Entra a la carpeta y pulsa Ordenar esta carpeta." },
  { title: "Marca los archivos", text: "Uno, varios o todos. El ⚠️ te muestra cuáles no cumplen la norma." },
  { title: "Elige bloque y tipo", text: "El nombre se arma solo. Revisa la vista previa y pulsa Renombrar." },
]

/** Mini guía de 3 pasos que aparece la primera vez */
function Guide({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative mb-5 overflow-hidden rounded-xl border bg-white">
      <div className="flex h-1" aria-hidden>
        <span className="flex-1 bg-brand-indigo" />
        <span className="flex-1 bg-brand-teal" />
        <span className="flex-1 bg-brand-yellow" />
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-center">
        {GUIDE_STEPS.map((s, i) => (
          <div key={s.title} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-white">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.text}</p>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={onClose} className="justify-self-end">
          Entendido
        </Button>
      </div>
    </div>
  )
}
