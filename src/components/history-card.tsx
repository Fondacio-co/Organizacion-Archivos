import { useMemo, useState } from "react"
import { DownloadIcon, HistoryIcon, SearchIcon, Trash2Icon, Undo2Icon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { normalize } from "@/lib/rename"
import type { RenameResult } from "@/lib/types"

export interface HistoryEntry {
  id: string
  at: Date
  folderName: string
  results: RenameResult[]
  undone: boolean
  /** rename = cambio de nombre (por defecto); trash = enviados a la papelera */
  action?: "rename" | "trash"
}

const timeFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const monthFmt = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" })
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const ALL = "todos"
type ActionFilter = "todos" | "rename" | "trash"
const ACTION_ITEMS: Record<ActionFilter, string> = {
  todos: "Renombrados y eliminados",
  rename: "Solo renombrados",
  trash: "Solo eliminados",
}

function downloadCsv(entry: HistoryEntry) {
  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`
  const trash = entry.action === "trash"
  const lines = [
    ["fecha", "carpeta", "accion", "id_archivo", "nombre_anterior", "nombre_nuevo", "resultado"].join(","),
    ...entry.results.map((r) =>
      [
        entry.at.toISOString(),
        entry.folderName,
        trash ? "papelera" : "renombrado",
        r.id,
        r.oldName,
        trash ? "" : r.newName,
        r.ok ? "ok" : `error: ${r.error ?? ""}`,
      ]
        .map((v) => esc(String(v)))
        .join(",")
    ),
  ]
  // BOM para que Excel muestre bien las tildes
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  const stamp = entry.at.toISOString().slice(0, 16).replace(/[:T]/g, "-")
  a.download = `registro-${trash ? "papelera" : "renombrado"}-${stamp}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function HistoryCard({
  entries,
  busy,
  onUndo,
}: {
  entries: HistoryEntry[]
  busy: boolean
  onUndo: (entry: HistoryEntry) => void
}) {
  const [month, setMonth] = useState<string>(ALL)
  const [action, setAction] = useState<ActionFilter>("todos")
  const [query, setQuery] = useState("")

  /** Meses que tienen cambios, del más reciente al más antiguo */
  const monthItems = useMemo(() => {
    const items: Record<string, string> = { [ALL]: "Todos los meses" }
    for (const e of entries) items[monthKey(e.at)] ??= capitalize(monthFmt.format(e.at))
    return items
  }, [entries])

  const q = normalize(query.trim())
  const shown = entries
    .filter((e) => month === ALL || monthKey(e.at) === month)
    .filter((e) => action === "todos" || (e.action ?? "rename") === action)
    .map((e) => ({
      entry: e,
      // archivos del lote que coinciden con la búsqueda (por nombre anterior o nuevo)
      matches: q ? e.results.filter((r) => normalize(r.oldName).includes(q) || normalize(r.newName).includes(q)) : [],
    }))
    .filter((x) => !q || x.matches.length > 0)
  const filtering = month !== ALL || action !== "todos" || !!q

  if (!entries.length)
    return (
      <section className="grid place-items-center rounded-xl border bg-white px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-secondary text-primary">
          <HistoryIcon className="size-5" />
        </span>
        <p className="mt-3 font-medium">Todavía no hay cambios</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cuando renombres o elimines archivos, cada lote aparecerá aquí para revisarlo o deshacerlo.
        </p>
      </section>
    )

  return (
    <section className="rounded-xl border bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <HistoryIcon className="size-4 text-primary" />
        <h2 className="font-semibold">Cambios recientes</h2>
        <span className="text-xs text-muted-foreground">
          {filtering ? `${shown.length} de ${entries.length}` : entries.length} {entries.length === 1 ? "lote" : "lotes"}
        </span>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 border-b bg-muted/40 px-4 py-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre de archivo (anterior o nuevo)…"
            aria-label="Buscar en el historial por nombre de archivo"
            className="h-9 bg-white pr-9 pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Borrar búsqueda"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        <Select items={monthItems} value={month} onValueChange={(v) => setMonth(v ?? ALL)}>
          <SelectTrigger className="h-9! min-w-44 bg-white" aria-label="Filtrar por mes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(monthItems).map(([k, l]) => (
              <SelectItem key={k} value={k}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={ACTION_ITEMS} value={action} onValueChange={(v) => setAction((v ?? "todos") as ActionFilter)}>
          <SelectTrigger className="h-9! min-w-52 bg-white" aria-label="Filtrar por acción">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACTION_ITEMS).map(([k, l]) => (
              <SelectItem key={k} value={k}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {shown.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
          No hay cambios con esos filtros.{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              setMonth(ALL)
              setAction("todos")
              setQuery("")
            }}
          >
            Quitar filtros
          </button>
        </div>
      ) : (
        <ul className="divide-y">
          {shown.map(({ entry: e, matches }) => {
            const ok = e.results.filter((r) => r.ok)
            const failed = e.results.length - ok.length
            const trash = e.action === "trash"
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {trash && <Trash2Icon className="size-3.5 text-brand-magenta" />}
                    {ok.length}{" "}
                    {trash
                      ? ok.length === 1
                        ? "archivo enviado a la papelera"
                        : "archivos enviados a la papelera"
                      : ok.length === 1
                        ? "archivo renombrado"
                        : "archivos renombrados"}
                    {failed > 0 && <Badge className="bg-danger-soft text-brand-magenta">{failed} con error</Badge>}
                    {e.undone && <Badge variant="outline">{trash ? "Restaurado" : "Deshecho"}</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {timeFmt.format(e.at)} · {e.folderName}
                    {!q && ok[0] && (
                      <>
                        {" "}· {trash ? `"${ok[0].oldName}"` : `"${ok[0].oldName}" → "${ok[0].newName}"`}
                        {ok.length > 1 && ` y ${ok.length - 1} más`}
                      </>
                    )}
                  </p>
                  {/* Con búsqueda: los archivos del lote que coinciden */}
                  {q &&
                    matches.slice(0, 4).map((r) => (
                      <p key={r.id} className="truncate text-xs">
                        {trash ? (
                          <span className="font-mono">{r.oldName}</span>
                        ) : (
                          <>
                            <span className="font-mono text-muted-foreground">{r.oldName}</span> →{" "}
                            <span className="font-mono">{r.newName}</span>
                          </>
                        )}
                      </p>
                    ))}
                  {q && matches.length > 4 && (
                    <p className="text-xs text-muted-foreground">… y {matches.length - 4} más</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => downloadCsv(e)}>
                    <DownloadIcon />
                    Registro CSV
                  </Button>
                  {!e.undone && ok.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => onUndo(e)}
                      className="border-brand-magenta/30 text-brand-magenta hover:bg-danger-soft hover:text-brand-magenta"
                    >
                      <Undo2Icon />
                      {trash ? "Restaurar" : "Deshacer"}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
