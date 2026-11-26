import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  BLOQUES,
  SIN_FECHA,
  TIPOS,
  toDescription,
  type Bloque,
  type DatePrecision,
  type NomenRule,
  type Tipo,
  type VersionChoice,
} from "@/lib/nomenclature"
import { splitName, type PreviewItem } from "@/lib/rename"

const PRECISIONS: [DatePrecision, string][] = [
  ["auto", "Como está"],
  ["day", "Día"],
  ["month", "Mes"],
  ["year", "Año"],
  ["none", "Sin fecha"],
]

const VERSION_LABELS: Record<VersionChoice, string> = {
  keep: "Dejar como está (v01 si no tiene)",
  v01: "v01",
  v02: "v02",
  v03: "v03",
  v04: "v04",
  v05: "v05",
  FINAL: "FINAL (aprobado)",
}

/** "keep" = mantener el bloque/tipo que ya trae cada archivo */
const KEEP = "keep"
const bloqueItems = {
  [KEEP]: "El que ya tiene",
  ...Object.fromEntries(Object.entries(BLOQUES).map(([k, v]) => [k, `${k} · ${v.label}`])),
}
const tipoItems = {
  [KEEP]: "El que ya tiene",
  ...Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, `${k} · ${v}`])),
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
  const color = BLOQUES[parts[0] as Bloque]?.color ?? "#3B3183"
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
}: {
  nomen: NomenRule
  onChange: (n: NomenRule) => void
  example?: PreviewItem
  count: number
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
            items={bloqueItems}
            value={nomen.bloque || KEEP}
            onValueChange={(v) => set({ bloque: (!v || v === KEEP ? "" : v) as Bloque | "" })}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-60">
              <SelectItem value={KEEP}>
                <span className="text-muted-foreground">El que ya tiene cada archivo</span>
              </SelectItem>
              {Object.entries(BLOQUES).map(([code, b]) => (
                <SelectItem key={code} value={code}>
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                  <b className="w-9">{code}</b>
                  <span className="text-muted-foreground">{b.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Step>
        <Step n={2} label="Tipo">
          <Select
            items={tipoItems}
            value={nomen.tipo || KEEP}
            onValueChange={(v) => {
              const tipo = (!v || v === KEEP ? "" : v) as Tipo | ""
              const sinFecha = !!tipo && SIN_FECHA.includes(tipo)
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
              <SelectItem value={KEEP}>
                <span className="text-muted-foreground">El que ya tiene cada archivo</span>
              </SelectItem>
              {Object.entries(TIPOS).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  <b className="w-9">{code}</b>
                  <span className="text-muted-foreground">{label}</span>
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
            ? nomen.tipo && SIN_FECHA.includes(nomen.tipo as Tipo)
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
