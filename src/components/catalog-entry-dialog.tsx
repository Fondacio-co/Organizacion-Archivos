import { useEffect, useState } from "react"
import { CheckIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  PALETTE,
  entryError,
  similarCode,
  type Catalog,
  type CatalogEntry,
  type CatalogKind,
} from "@/lib/catalog"

export interface EntryDialogState {
  kind: CatalogKind
  /** Si viene, se está editando esa entrada (el código no cambia) */
  editing?: CatalogEntry
}

/** Formulario para crear o editar un bloque o un tipo */
export function CatalogEntryDialog({
  state,
  catalog,
  onClose,
  onSave,
}: {
  state: EntryDialogState | null
  catalog: Catalog
  onClose: () => void
  onSave: (kind: CatalogKind, entry: CatalogEntry, editing?: string) => Promise<void>
}) {
  const kind = state?.kind ?? "bloques"
  const editing = state?.editing
  const isBloque = kind === "bloques"

  const [code, setCode] = useState("")
  const [label, setLabel] = useState("")
  const [color, setColor] = useState(PALETTE[0])
  const [sinFecha, setSinFecha] = useState(false)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  // Al abrir, carga los datos de la entrada que se edita o deja el formulario limpio
  useEffect(() => {
    if (!state) return
    setCode(state.editing?.code ?? "")
    setLabel(state.editing?.label ?? "")
    setColor(state.editing?.color ?? PALETTE[catalog[state.kind].length % PALETTE.length])
    setSinFecha(!!state.editing?.sinFecha)
    setTouched(false)
    setSaving(false)
    // solo al abrir: si el catálogo cambia mientras está abierto no se borra lo escrito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const entry: CatalogEntry = { code, label, color, ...(sinFecha ? { sinFecha } : {}) }
  const error = entryError(entry, catalog, kind, editing?.code)
  const similar = !editing ? similarCode(code, catalog, kind) : null
  const shownCode = code || (isBloque ? "XXX" : "YYY")

  const submit = async () => {
    setTouched(true)
    if (error) return
    setSaving(true)
    try {
      await onSave(kind, entry, editing?.code)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? `Editar ${isBloque ? "bloque" : "tipo"} ${editing.code}`
              : isBloque
                ? "Nuevo bloque"
                : "Nuevo tipo"}
          </DialogTitle>
          <DialogDescription>
            {isBloque
              ? "El bloque es quién produce el documento. Va al inicio del nombre."
              : "El tipo es qué clase de documento es. Va después del bloque."}{" "}
            Se guarda para todos los usuarios.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cat-code" className="text-xs text-muted-foreground">
                Código
              </Label>
              <Input
                id="cat-code"
                value={code}
                disabled={!!editing}
                maxLength={4}
                autoFocus={!editing}
                placeholder={isBloque ? "EDU" : "INV"}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                className="font-mono text-base font-semibold tracking-widest uppercase"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cat-label" className="text-xs text-muted-foreground">
                {isBloque ? "Nombre" : "Qué documentos son"}
              </Label>
              <Input
                id="cat-label"
                value={label}
                autoFocus={!!editing}
                maxLength={80}
                placeholder={isBloque ? "ej. Educación Ambiental" : "ej. Inventarios"}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
          {editing && (
            <p className="-mt-2 text-[11px] text-muted-foreground">
              El código no se puede cambiar: los archivos que ya lo usan quedarían sin nomenclatura.
            </p>
          )}

          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    "grid size-7 place-items-center rounded-full ring-offset-2 transition-transform hover:scale-110",
                    color.toUpperCase() === c && "ring-2 ring-foreground"
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color.toUpperCase() === c && <CheckIcon className="size-3.5 text-white" />}
                </button>
              ))}
              <label
                className="relative grid size-7 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed text-[10px] text-muted-foreground"
                title="Otro color"
              >
                +
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>

          {!isBloque && (
            <div className="flex items-center justify-between rounded-lg bg-muted/70 px-3 py-2">
              <Label htmlFor="cat-sinfecha" className="text-sm font-normal">
                Va sin fecha <span className="text-muted-foreground">(como manuales y formatos)</span>
              </Label>
              <Switch id="cat-sinfecha" checked={sinFecha} onCheckedChange={setSinFecha} />
            </div>
          )}

          {/* Así se vería en un nombre */}
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Así se verá en un nombre
            </p>
            <p className="font-mono text-[13px] break-all">
              {isBloque ? (
                <>
                  <span className="rounded px-1 font-semibold text-white" style={{ backgroundColor: color }}>
                    {shownCode}
                  </span>
                  _IAC_2026-05_JornadaSiembra_v01
                </>
              ) : (
                <>
                  CAM_
                  <span className="rounded px-1 font-semibold text-white" style={{ backgroundColor: color }}>
                    {shownCode}
                  </span>
                  {sinFecha ? "_GuiaUso_v01" : "_2026-05_JornadaSiembra_v01"}
                </>
              )}
            </p>
          </div>

          {similar && (
            <p className="flex items-start gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
              {code} se parece a {similar.code} ({similar.label}). Revisa que no sea el mismo antes de crearlo.
            </p>
          )}
          {touched && error && <p className="text-xs text-brand-magenta">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || (touched && !!error)}>
              {saving && <Loader2Icon className="animate-spin" />}
              {editing ? "Guardar cambios" : isBloque ? "Crear bloque" : "Crear tipo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
