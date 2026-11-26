import { DownloadIcon, HistoryIcon, Undo2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RenameResult } from "@/lib/types"

export interface HistoryEntry {
  id: string
  at: Date
  folderName: string
  results: RenameResult[]
  undone: boolean
}

const timeFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

function downloadCsv(entry: HistoryEntry) {
  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`
  const lines = [
    ["fecha", "carpeta", "id_archivo", "nombre_anterior", "nombre_nuevo", "resultado"].join(","),
    ...entry.results.map((r) =>
      [
        entry.at.toISOString(),
        entry.folderName,
        r.id,
        r.oldName,
        r.newName,
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
  a.download = `registro-renombrado-${stamp}.csv`
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
  if (!entries.length)
    return (
      <section className="grid place-items-center rounded-xl border bg-white px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-secondary text-primary">
          <HistoryIcon className="size-5" />
        </span>
        <p className="mt-3 font-medium">Todavía no hay cambios</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cuando renombres archivos, cada lote aparecerá aquí para revisarlo o deshacerlo.
        </p>
      </section>
    )
  return (
    <section className="rounded-xl border bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <HistoryIcon className="size-4 text-primary" />
        <h2 className="font-semibold">Cambios recientes</h2>
      </div>
      <ul className="divide-y">
        {entries.map((e) => {
          const ok = e.results.filter((r) => r.ok)
          const failed = e.results.length - ok.length
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {ok.length} {ok.length === 1 ? "archivo renombrado" : "archivos renombrados"}
                  {failed > 0 && (
                    <Badge className="bg-danger-soft text-brand-magenta">{failed} con error</Badge>
                  )}
                  {e.undone && <Badge variant="outline">Deshecho</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {timeFmt.format(e.at)} · {e.folderName}
                  {ok[0] && (
                    <>
                      {" "}· "{ok[0].oldName}" → "{ok[0].newName}"
                      {ok.length > 1 && ` y ${ok.length - 1} más`}
                    </>
                  )}
                </p>
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
                    Deshacer
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
