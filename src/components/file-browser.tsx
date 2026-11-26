import {
  CircleCheckIcon,
  CopyIcon,
  CornerDownRightIcon,
  LockIcon,
  SearchIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import type { DuplicateInfo } from "@/lib/duplicates"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { normalize } from "@/lib/rename"
import type { DriveFile, FileKind } from "@/lib/types"
import { FileKindIcon, KIND_LABELS } from "./file-kind-icon"

export type KindFilter = "all" | Exclude<FileKind, "folder">

const KIND_FILTERS: Record<KindFilter, string> = {
  all: "Todos los tipos",
  pdf: "PDF",
  doc: "Documentos",
  sheet: "Hojas de cálculo",
  slides: "Presentaciones",
  image: "Imágenes",
  video: "Videos",
  audio: "Audio",
  zip: "Comprimidos",
  other: "Otros",
}

const MAX_ROWS = 400

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" })

/** Resalta (como con marcador) la parte del nombre que coincide con la búsqueda */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = normalize(query.trim())
  if (!q) return <>{text}</>
  const chars = Array.from(text)
  const norm = chars.map((c) => normalize(c))
  if (norm.some((c) => c.length !== 1)) return <>{text}</>
  const i = norm.join("").indexOf(q)
  if (i < 0) return <>{text}</>
  return (
    <>
      {chars.slice(0, i).join("")}
      <mark className="rounded-[3px] bg-highlight px-0.5 text-foreground">
        {chars.slice(i, i + q.length).join("")}
      </mark>
      {chars.slice(i + q.length).join("")}
    </>
  )
}

export function FileBrowser({
  loading,
  visible,
  totalSelected,
  hiddenSelected,
  selected,
  query,
  kind,
  includeSubfolders,
  truncated,
  issues,
  nonCompliantCount,
  onlyNonCompliant,
  onOnlyNonCompliant,
  duplicates,
  duplicateCount,
  onlyDuplicates,
  onOnlyDuplicates,
  onDeleteSelected,
  onQuery,
  onKind,
  onIncludeSubfolders,
  onToggle,
  onToggleAll,
  onClearSelection,
}: {
  loading: boolean
  visible: DriveFile[]
  totalSelected: number
  /** Seleccionados que no se ven por la búsqueda o los filtros (igual se renombran) */
  hiddenSelected: number
  selected: Set<string>
  query: string
  kind: KindFilter
  includeSubfolders: boolean
  truncated: boolean
  /** Motivo por el que cada archivo no cumple la nomenclatura */
  issues: Map<string, string>
  nonCompliantCount: number
  onlyNonCompliant: boolean
  onOnlyNonCompliant: (v: boolean) => void
  /** Archivos duplicados (copias idénticas o mismo nombre) */
  duplicates: Map<string, DuplicateInfo>
  duplicateCount: number
  onlyDuplicates: boolean
  onOnlyDuplicates: (v: boolean) => void
  /** Manda los seleccionados a la papelera (pide confirmación) */
  onDeleteSelected: () => void
  onQuery: (q: string) => void
  onKind: (k: KindFilter) => void
  onIncludeSubfolders: (v: boolean) => void
  onToggle: (id: string) => void
  onToggleAll: (select: boolean) => void
  onClearSelection: () => void
}) {
  const selectedVisible = visible.filter((f) => selected.has(f.id)).length
  const allChecked = visible.length > 0 && selectedVisible === visible.length
  const someChecked = selectedVisible > 0 && !allChecked
  const rows = visible.slice(0, MAX_ROWS)

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white">
      {/* Barra de búsqueda */}
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Buscar por nombre… (ej. factura, borrador, IMG_)"
            className="h-10 pr-9 pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery("")}
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Borrar búsqueda"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Select items={KIND_FILTERS} value={kind} onValueChange={(v) => onKind((v ?? "all") as KindFilter)}>
            <SelectTrigger className="h-10! min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_FILTERS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="subfolders" checked={includeSubfolders} onCheckedChange={onIncludeSubfolders} />
            <Label htmlFor="subfolders" className="text-sm font-normal whitespace-nowrap">
              Subcarpetas
            </Label>
          </div>
        </div>
      </div>

      {/* Encabezado de la lista */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground">
        <Checkbox
          checked={allChecked}
          indeterminate={someChecked}
          disabled={!visible.length}
          onCheckedChange={() => onToggleAll(!allChecked)}
          aria-label="Seleccionar todos los resultados"
        />
        <span className="flex-1 whitespace-nowrap">
          {loading
            ? "Cargando archivos…"
            : `${visible.length.toLocaleString("es")} ${visible.length === 1 ? "resultado" : "resultados"}`}
        </span>
        {!loading && (nonCompliantCount > 0 || onlyNonCompliant) && (
          <button
            type="button"
            onClick={() => onOnlyNonCompliant(!onlyNonCompliant)}
            title="Archivos cuyo nombre no sigue la nomenclatura BLOQUE_TIPO_FECHA_Descripcion_Version"
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
              onlyNonCompliant
                ? "bg-warning text-white"
                : "bg-warning-soft text-warning hover:bg-warning/15"
            }`}
          >
            <TriangleAlertIcon className="size-3" />
            {onlyNonCompliant ? "Mostrando" : ""} {nonCompliantCount} sin nomenclatura
            {onlyNonCompliant && <XIcon className="size-3" />}
          </button>
        )}
        {!loading && (duplicateCount > 0 || onlyDuplicates) && (
          <button
            type="button"
            onClick={() => onOnlyDuplicates(!onlyDuplicates)}
            title="Copias idénticas (mismo contenido) o archivos con el mismo nombre"
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
              onlyDuplicates ? "bg-success text-white" : "bg-success-soft text-success hover:bg-brand-teal/15"
            }`}
          >
            <CopyIcon className="size-3" />
            {onlyDuplicates ? "Mostrando" : ""} {duplicateCount} duplicados
            {onlyDuplicates && <XIcon className="size-3" />}
          </button>
        )}
        {totalSelected > 0 && (
          <span className="flex items-center gap-2 whitespace-nowrap text-primary">
            {totalSelected} {totalSelected === 1 ? "seleccionado" : "seleccionados"}
            {hiddenSelected > 0 && (
              <span className="font-normal text-warning" title="Están seleccionados pero no se ven por la búsqueda o los filtros. También se renombrarán.">
                ({hiddenSelected} {hiddenSelected === 1 ? "oculto" : "ocultos"})
              </span>
            )}
            <Button variant="ghost" size="xs" onClick={onClearSelection} className="text-muted-foreground">
              Quitar selección
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={onDeleteSelected}
              className="border-brand-magenta/30 text-brand-magenta hover:bg-danger-soft hover:text-brand-magenta"
            >
              <Trash2Icon /> Eliminar
            </Button>
          </span>
        )}
        <span className="hidden w-28 text-right md:block">Modificado</span>
      </div>

      {/* Lista */}
      <div className="max-h-[calc(100vh-300px)] min-h-72 flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5" style={{ width: `${40 + ((i * 37) % 45)}%` }} />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <SearchIcon className="size-5" />
            </span>
            <p className="mt-3 font-medium">No hay archivos que coincidan</p>
            <p className="text-sm text-muted-foreground">Prueba con otra palabra o cambia el tipo de archivo.</p>
          </div>
        ) : (
          <ul>
            {rows.map((f) => {
              const checked = selected.has(f.id)
              return (
                <li key={f.id}>
                  <div
                    role="checkbox"
                    aria-checked={checked}
                    tabIndex={0}
                    onClick={() => onToggle(f.id)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault()
                        onToggle(f.id)
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-3 border-b border-border/70 px-4 py-2.5 transition-colors outline-none select-none focus-visible:bg-secondary ${
                      checked ? "bg-secondary/70 hover:bg-secondary" : "hover:bg-muted/60"
                    }`}
                  >
                    <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                    <FileKindIcon kind={f.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium" title={f.name}>
                        <span className="truncate">
                          <Highlight text={f.name} query={query} />
                        </span>
                        {!issues.has(f.id) ? (
                          <span title="Cumple la nomenclatura" className="shrink-0">
                            <CircleCheckIcon className="size-3.5 text-brand-teal" aria-label="Cumple la nomenclatura" />
                          </span>
                        ) : (
                          <span title={issues.get(f.id)} className="shrink-0 cursor-help">
                            <TriangleAlertIcon className="size-3.5 text-brand-orange/80" aria-label={issues.get(f.id)} />
                          </span>
                        )}
                        {!f.canRename && (
                          <LockIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Sin permiso para renombrar" />
                        )}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {f.path ? (
                          <>
                            <CornerDownRightIcon className="size-3 shrink-0" />
                            <span className="truncate">{f.path}</span>
                          </>
                        ) : (
                          KIND_LABELS[f.kind]
                        )}
                      </p>
                      {onlyNonCompliant && issues.has(f.id) && (
                        <p className="truncate text-xs text-warning">{issues.get(f.id)}</p>
                      )}
                      {onlyDuplicates && duplicates.has(f.id) && (
                        <p className="flex items-center gap-1 truncate text-xs text-success">
                          <CopyIcon className="size-3 shrink-0" />
                          {duplicates.get(f.id)!.reason}
                        </p>
                      )}
                    </div>
                    <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums md:block">
                      {dateFmt.format(new Date(f.modifiedTime))}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!loading && visible.length > MAX_ROWS && (
          <p className="px-4 py-3 text-center text-xs text-muted-foreground">
            Se muestran {MAX_ROWS} de {visible.length.toLocaleString("es")}. Escribe algo más específico para
            acotar (la casilla de arriba sí selecciona todos los resultados).
          </p>
        )}
        {!loading && truncated && (
          <p className="px-4 py-3 text-center text-xs text-warning">
            La carpeta es muy grande: solo se leyeron los primeros 5.000 archivos.
          </p>
        )}
      </div>
    </section>
  )
}
