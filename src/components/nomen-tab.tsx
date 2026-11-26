import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Catalog, CatalogKind } from "@/lib/catalog"
import {
  bloqueInfo,
  isSinFecha,
  toDescription,
  type Bloque,
  type DatePrecision,
  type NomenRule,
  type Tipo,
  type VersionChoice,
  VERSIONS,
} from "@/lib/nomenclature"
import { splitName, type PreviewItem } from "@/lib/rename"

const PRECISIONS: [DatePrecision, string][] = [
  ["auto", "Actual"],
  ["day", "Día"],
  ["month", "Mes"],
  ["year", "Año"],
  ["none", "Sin fecha"],
]

/** La versión es opcional: Actual (la que tenga, o ninguna), Sin versión, v01…v20, FINAL */
const VERSION_LABELS: Record<VersionChoice, string> = Object.fromEntries(
  VERSIONS.map((v) => [
    v,
    v === "keep" ? "Actual (la que tenga, o ninguna)" : v === "none" ? "Sin versión" : v === "FINAL" ? "FINAL (aprobado)" : v,
  ])
)

/** "keep" = mantener el bloque/tipo que ya trae cada archivo */
const KEEP = "keep"
/** Opción "+ Crear nuevo…" (no es un código: abre el formulario) */
const NEW = "__nuevo__"

function itemsFor(catalog: Catalog, kind: CatalogKind) {
  return {
    [KEEP]: "Actual",
    [NEW]: kind === "bloques" ? "Crear nuevo bloque" : "Crear nuevo tipo",
    ...Object.fromEntries(catalog[kind].map((e) => [e.code, `${e.code} · ${e.label}`])),
  }
}

/** Primera opción de los menús: crear una categoría (solo administradores) */
function CreateItem({ kind, canEdit }: { kind: CatalogKind; canEdit: boolean }) {
  return (
    <SelectItem value={NEW} disabled={!canEdit} className="font-medium text-primary">
      <PlusIcon className="size-4" />
      {kind === "bloques" ? "Crear nuevo bloque" : "Crear nuevo tipo"}
      {!canEdit && <span className="text-[11px] font-normal text-muted-foreground">(solo administradores)</span>}
    </SelectItem>
  )
}

function Step({ n, label, hint, children }: { n: number; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="grid size-4.5 place-items-center rounded-full bg-secondary text-[10px] font-semibold text-primary">
          {n}
        </span>
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Muestra el nombre armado, con cada parte resaltada */
function NamePreview({ example, count }: { example?: PreviewItem; count: number }) {
  if (!example) return null
  if (example.status === "incomplete") {
    return (
      <div className="rounded-lg border border-dashed border-warning/50 bg-warning-soft/40 px-3 py-3 text-xs">
        <p className="font-medium text-warning">{example.note}</p>
        <p className="mt-0.5 text-muted-foreground">
          {example.note === "Falta la descripción"
            ? "Escríbela abajo y el nombre se arma solo."
            : `No se reconoce en "${example.file.name}". Elígelo abajo y el nombre se arma solo.`}
        </p>
      </div>
    )
  }
  const { base, ext } = splitName({ name: example.newName, native: example.file.native })
  const parts = base.split("_")
  const color = bloqueInfo(parts[0])?.color ?? "#3B3183"
  const same = example.status === "same"
  return (
    <div className="rounded-lg bg-primary px-3 py-3 text-white">
      <p className="mb-1 text-[10px] font-semibold tracking-wider text-white/60 uppercase">
        {same ? "Ya cumple la nomenclatura" : count > 1 ? "Sugerencia (primer archivo)" : "Sugerencia"}
      </p>
      <p className="font-mono text-[13px] leading-relaxed break-all">
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 && <span className="text-white/40">_</span>}
            <span
              className={cn(i === 0 && "rounded px-1 font-semibold", i === parts.length - 2 && "text-brand-yellow")}
              style={i === 0 ? { backgroundColor: color } : undefined}
            >
              {p}
            </span>
          </span>
        ))}
        <span className="text-white/50">{ext}</span>
      </p>
    </div>
  )
}

export function NomenTab({
  nomen,
  onChange,
  example,
  count,
  catalog,
  canEdit,
  onCreate,
}: {
  nomen: NomenRule
  onChange: (n: NomenRule) => void
  example?: PreviewItem
  count: number
  catalog: Catalog
  /** true = la cuenta es administradora y puede crear categorías */
  canEdit: boolean
  /** Abre el formulario para crear un bloque o tipo nuevo */
  onCreate: (kind: CatalogKind) => void
}) {
  const set = (patch: Partial<NomenRule>) => onChange({ ...nomen, ...patch })
  const typed = toDescription(nomen.description)

  return (
    <div className="grid gap-4">
      <NamePreview example={example} count={count} />
      <p className="-mt-2 text-[11px] text-muted-foreground">
        Se usa lo que ya trae el nombre. Cambia solo lo que quieras y pulsa Renombrar.
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <Step n={1} label="Bloque">
          <Select
            items={itemsFor(catalog, "bloques")}
            value={nomen.bloque || KEEP}
            onValueChange={(v) => {
              if (v === NEW) return onCreate("bloques")
              set({ bloque: (!v || v === KEEP ? "" : v) as Bloque | "" })
            }}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-60">
              <CreateItem kind="bloques" canEdit={canEdit} />
              <SelectItem value={KEEP}>
                <span className="text-muted-foreground">Actual</span>
              </SelectItem>
              {catalog.bloques.map((b) => (
                <SelectItem key={b.code} value={b.code}>
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                  <b className="w-9">{b.code}</b>
                  <span className="text-muted-foreground">{b.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Step>
        <Step n={2} label="Tipo">
          <Select
            items={itemsFor(catalog, "tipos")}
            value={nomen.tipo || KEEP}
            onValueChange={(v) => {
              if (v === NEW) return onCreate("tipos")
              const tipo = (!v || v === KEEP ? "" : v) as Tipo | ""
              const sinFecha = !!tipo && isSinFecha(tipo)
              set({
                tipo,
                // manuales, fichas y formatos van sin fecha (salvo que ya traigan una y se respete)
                precision:
                  nomen.precision === "auto"
                    ? "auto"
                    : sinFecha
                      ? "none"
                      : nomen.precision === "none"
                        ? "auto"
                        : nomen.precision,
              })
            }}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80 min-w-80">
              <CreateItem kind="tipos" canEdit={canEdit} />
              <SelectItem value={KEEP}>
                <span className="text-muted-foreground">Actual</span>
              </SelectItem>
              {catalog.tipos.map((t) => (
                <SelectItem key={t.code} value={t.code}>
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <b className="w-9">{t.code}</b>
                  <span className="text-muted-foreground">{t.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Step>
      </div>

      <Step
        n={3}
        label="Fecha"
        hint={
          nomen.precision === "auto"
            ? "Se respeta la fecha que ya trae el nombre. Si no tiene, se usa la del archivo: revísala abajo."
            : nomen.precision === "none"
            ? nomen.tipo && isSinFecha(nomen.tipo)
              ? "Los manuales, fichas y formatos van sin fecha."
              : undefined
            : nomen.date
              ? undefined
              : count > 1
                ? "Si no eliges, cada archivo usa la suya: revísalas abajo."
                : "Si no eliges, se usa la del archivo: revísala abajo."
        }
      >
        <div className="grid grid-cols-5 gap-1 rounded-lg bg-muted p-[3px]">
          {PRECISIONS.map(([p, label]) => (
            <button
              key={p}
              type="button"
              onClick={() => set({ precision: p })}
              className={cn(
                "h-7 rounded-md text-xs font-medium transition-colors",
                nomen.precision === p ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {nomen.precision !== "none" && (
          <Input
            type="date"
            value={nomen.date}
            onChange={(e) => set({ date: e.target.value })}
            aria-label="Misma fecha para todos (opcional)"
            title="Misma fecha para todos (opcional)"
          />
        )}
      </Step>

      <Step
        n={4}
        label={count > 1 ? "Descripción (opcional)" : "Descripción"}
        hint={
          nomen.description ? (
            <>
              Quedará como <b className="font-mono text-foreground">{typed || "—"}</b>
              {count > 1 && " (igual para todos)"}
            </>
          ) : count > 1 ? (
            "Escríbela aquí para todos, o corrígela en cada archivo abajo."
          ) : (
            "Si la dejas vacía se toma del nombre actual."
          )
        }
      >
        <Input
          value={nomen.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder={count > 1 ? "La misma para todos…" : "ej. jornada de siembra"}
        />
      </Step>

      <Step n={5} label="Versión">
        <Select
          items={VERSION_LABELS}
          value={nomen.version}
          onValueChange={(v) => set({ version: (v ?? "keep") as VersionChoice })}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(VERSION_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Step>
    </div>
  )
}
