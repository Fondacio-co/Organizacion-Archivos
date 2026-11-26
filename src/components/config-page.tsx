import { useState } from "react"
import {
  DatabaseIcon,
  ExternalLinkIcon,
  Loader2Icon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Catalog, CatalogEntry, CatalogKind } from "@/lib/catalog"
import type { CatalogFile } from "@/lib/types"

export type CatalogStatus = "loading" | "ready" | "missing" | "damaged" | "error"

const dateFmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" })

export function ConfigPage({
  catalog,
  file,
  status,
  errorText,
  demo,
  onCreateBase,
  onEdit,
  onDelete,
  onReload,
}: {
  catalog: Catalog
  file: CatalogFile | null
  status: CatalogStatus
  errorText?: string
  demo: boolean
  onCreateBase: () => Promise<void>
  /** Abre el formulario: sin `entry` crea uno nuevo */
  onEdit: (kind: CatalogKind, entry?: CatalogEntry) => void
  onDelete: (kind: CatalogKind, code: string) => Promise<void>
  onReload: () => void
}) {
  const canEdit = !!file?.canEdit && status === "ready"
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<{ kind: CatalogKind; entry: CatalogEntry } | null>(null)
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Códigos de bloque y de tipo que usa la nomenclatura. Son los mismos para todos los usuarios.
        </p>
      </div>

      {/* Estado de la base de códigos */}
      <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <DatabaseIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          {status === "loading" ? (
            <p className="flex items-center gap-2 text-sm">
              <Loader2Icon className="size-4 animate-spin" /> Buscando la base de códigos…
            </p>
          ) : status === "missing" ? (
            <>
              <p className="font-medium">Todavía no hay base de códigos en Drive</p>
              <p className="text-sm text-muted-foreground">
                Se están usando los códigos de fábrica. Un administrador debe crear la base: se guarda como
                un archivo .json en su Drive, se comparte en solo lectura con toda la organización y
                quien la crea queda como administrador.
              </p>
            </>
          ) : status === "error" || status === "damaged" ? (
            <>
              <p className="font-medium text-brand-magenta">
                {status === "damaged" ? "El archivo de códigos está dañado" : "No se pudo leer la base de códigos"}
              </p>
              <p className="text-sm text-muted-foreground">
                {status === "damaged"
                  ? "Alguien lo editó a mano y ya no se puede leer. Mientras tanto se usan los códigos de fábrica."
                  : errorText}
              </p>
            </>
          ) : (
            <>
              <p className="flex flex-wrap items-center gap-2 font-medium">
                Base de códigos {demo ? "(demostración)" : "en Drive"}
                {canEdit ? (
                  <Badge className="gap-1 bg-success-soft text-success">
                    <ShieldCheckIcon /> Eres administrador
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <LockIcon /> Solo lectura
                  </Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {canEdit
                  ? "Puedes crear, editar y eliminar códigos. Para nombrar otro administrador, compártele el archivo como Editor en Drive."
                  : "Solo los administradores pueden cambiar los códigos. Si necesitas uno nuevo, pídeselo a quien administra el archivo."}
                {catalog.updatedAt && (
                  <span className="block text-xs">
                    Último cambio: {dateFmt.format(new Date(catalog.updatedAt))}
                    {catalog.updatedBy && ` por ${catalog.updatedBy}`}
                  </span>
                )}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "missing" && (
            <Button
              disabled={creating}
              onClick={async () => {
                setCreating(true)
                try {
                  await onCreateBase()
                } finally {
                  setCreating(false)
                }
              }}
            >
              {creating ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              Crear base de códigos
            </Button>
          )}
          {file?.webViewLink && (
            <Button
              variant="ghost"
              size="sm"
              render={<a href={file.webViewLink} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <ExternalLinkIcon /> Abrir en Drive
            </Button>
          )}
          {status !== "loading" && (
            <Button variant="outline" size="sm" onClick={onReload}>
              <RefreshCwIcon /> Recargar
            </Button>
          )}
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {(["bloques", "tipos"] as const).map((kind) => (
          <section key={kind} className="overflow-hidden rounded-xl border bg-white">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">{kind === "bloques" ? "Bloques" : "Tipos"}</h2>
                <p className="text-xs text-muted-foreground">
                  {kind === "bloques" ? "Quién produce el documento" : "Qué clase de documento es"} ·{" "}
                  {catalog[kind].length}
                </p>
              </div>
              {canEdit && (
                <Button size="sm" onClick={() => onEdit(kind)}>
                  <PlusIcon /> {kind === "bloques" ? "Nuevo bloque" : "Nuevo tipo"}
                </Button>
              )}
            </div>
            <ul className="divide-y">
              {catalog[kind].map((e) => (
                <li key={e.code} className="group flex items-center gap-3 px-4 py-2.5">
                  <span
                    className="grid h-7 w-12 shrink-0 place-items-center rounded-md font-mono text-xs font-semibold text-white"
                    style={{ backgroundColor: e.color }}
                  >
                    {e.code}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    {e.label}
                    {e.sinFecha && <span className="ml-1.5 text-xs text-muted-foreground">(sin fecha)</span>}
                  </span>
                  {canEdit && (
                    <span className="flex shrink-0 gap-1 opacity-60 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${e.code}`} onClick={() => onEdit(kind, e)}>
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${e.code}`}
                        className="text-brand-magenta hover:bg-danger-soft hover:text-brand-magenta"
                        disabled={catalog[kind].length <= 1}
                        onClick={() => setToDelete({ kind, entry: e })}
                      >
                        <Trash2Icon />
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar el {toDelete?.kind === "bloques" ? "bloque" : "tipo"} {toDelete?.entry.code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              «{toDelete?.entry.label}» dejará de aparecer para todos los usuarios. Los archivos que ya usan{" "}
              {toDelete?.entry.code} no se cambian en Drive, pero pasarán a mostrarse como ⚠️ sin nomenclatura.
              Si te equivocas, puedes volver a crearlo con el mismo código.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-brand-magenta text-white hover:bg-brand-magenta/90"
              onClick={async () => {
                if (!toDelete) return
                setDeleting(true)
                try {
                  await onDelete(toDelete.kind, toDelete.entry.code)
                  setToDelete(null)
                } finally {
                  setDeleting(false)
                }
              }}
            >
              {deleting && <Loader2Icon className="animate-spin" />}
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
