import { useState, type ReactNode } from "react"
import { ArrowRightIcon, Loader2Icon, LockIcon, MousePointerClickIcon, TriangleAlertIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  numbered,
  splitName,
  type NumberStyle,
  type PreviewItem,
  type PreviewStatus,
  type RenameMode,
  type RenameRule,
} from "@/lib/rename"
import { FileKindIcon } from "./file-kind-icon"
import { NomenTab } from "./nomen-tab"
import type { Catalog, CatalogKind } from "@/lib/catalog"
import { CodesLegend } from "./codes-legend"
import { cn } from "@/lib/utils"
import { DATE_LEN, isPeriod, nomenParts } from "@/lib/nomenclature"

const STATUS: Record<PreviewStatus, { label: string; className: string } | null> = {
  change: null,
  same: { label: "Sin cambios", className: "bg-muted text-muted-foreground" },
  empty: { label: "Nombre vacío", className: "bg-danger-soft text-brand-magenta" },
  duplicate: { label: "Nombre repetido", className: "bg-danger-soft text-brand-magenta" },
  locked: { label: "Sin permiso", className: "bg-danger-soft text-brand-magenta" },
  invalid: { label: "Patrón inválido", className: "bg-danger-soft text-brand-magenta" },
  incomplete: { label: "Falta la descripción", className: "bg-warning-soft text-warning" },
}

/** Solo se renombran los que no tienen ningún problema */
export const APPLICABLE: PreviewStatus[] = ["change"]

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function CheckField({
  id,
  checked,
  onChange,
  children,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="text-sm font-normal">
        {children}
      </Label>
    </div>
  )
}

function numberStyleItems(name: string): Record<NumberStyle, string> {
  const n = name.trim() || "Nombre"
  return {
    underscore: numbered(n, 1, 9, "underscore"),
    space: numbered(n, 1, 9, "space"),
    dash: numbered(n, 1, 9, "dash"),
    paren: numbered(n, 1, 9, "paren"),
  }
}

const CASE_OPTIONS = {
  keep: "Sin cambiar",
  lower: "minúsculas",
  upper: "MAYÚSCULAS",
  title: "Cada Palabra Con Mayúscula",
  sentence: "Solo la primera",
}
const SEPARATOR_OPTIONS = {
  keep: "Sin cambiar",
  space: "Espacios",
  underscore: "Guion bajo _",
  dash: "Guion -",
}

export function RenamePanel({
  rule,
  onRule,
  preview,
  regexError,
  applying,
  onApply,
  catalog,
  canEditCatalog,
  onCreateCatalogEntry,
}: {
  rule: RenameRule
  onRule: (r: RenameRule) => void
  preview: PreviewItem[]
  regexError: boolean
  applying: { done: number; total: number } | null
  onApply: () => void
  catalog: Catalog
  canEditCatalog: boolean
  onCreateCatalogEntry: (kind: CatalogKind) => void
}) {
  const set = <K extends keyof RenameRule>(key: K, value: Partial<RenameRule[K]>) =>
    onRule({ ...rule, [key]: typeof value === "object" ? { ...(rule[key] as object), ...value } : value })

  const applicable = preview.filter((p) => APPLICABLE.includes(p.status)).length
  const issues = preview.filter((p) => ["empty", "locked", "duplicate", "incomplete"].includes(p.status)).length
  const empty = preview.length === 0
  const [showMore, setShowMore] = useState(rule.mode !== "nomen")

  return (
    <aside className="flex flex-col overflow-hidden rounded-xl border bg-white lg:sticky lg:top-24 lg:max-h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5">
        <div>
          <h2 className="font-semibold">Renombrar</h2>
          <p className="text-xs text-muted-foreground">
            {showMore ? "Elige cómo cambiar los nombres" : "Elige los datos y el nombre se arma solo"}
          </p>
        </div>
        <Badge variant={empty ? "outline" : "default"} className="tabular-nums">
          {preview.length} {preview.length === 1 ? "archivo" : "archivos"}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs
          value={rule.mode}
          onValueChange={(v) => onRule({ ...rule, mode: v as RenameMode })}
          className="gap-0"
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <CodesLegend catalog={catalog} />
            <button
              type="button"
              onClick={() => {
                if (showMore) onRule({ ...rule, mode: "nomen" })
                setShowMore(!showMore)
              }}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {showMore ? "Volver a lo simple" : "Más opciones"}
            </button>
          </div>
          <div className={cn("px-4 pt-3", !showMore && "hidden")}>
            <TabsList className="grid h-auto! w-full grid-cols-3 gap-0.5">
              {(
                [
                  ["nomen", "Nomenclatura"],
                  ["rename", "Nombre nuevo"],
                  ["replace", "Reemplazar"],
                  ["affix", "Agregar"],
                  ["format", "Formato"],
                  ["manual", "Manual"],
                ] as const
              ).map(([v, l]) => (
                <TabsTrigger key={v} value={v} className="h-8 text-xs">
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="grid gap-4 p-4">
            <TabsContent value="nomen">
              <NomenTab
                nomen={rule.nomen}
                onChange={(nomen) => onRule({ ...rule, nomen })}
                example={preview[0]}
                count={preview.length}
                catalog={catalog}
                canEdit={canEditCatalog}
                onCreate={onCreateCatalogEntry}
              />
            </TabsContent>

            <TabsContent value="rename" className="grid gap-3">
              <Field label={preview.length > 1 ? "Nombre nuevo para todos" : "Nombre nuevo"}>
                <Input
                  value={rule.rename.name}
                  onChange={(e) => set("rename", { name: e.target.value })}
                  placeholder={
                    preview.length === 1 ? splitName(preview[0].file).base : "Escribe el nombre nuevo"
                  }
                  className="h-10 text-[15px]"
                />
              </Field>
              {preview.length > 1 && (
                <div className="grid gap-3 rounded-lg border border-dashed p-3">
                  <p className="text-xs text-muted-foreground">
                    Como son {preview.length} archivos, se numeran solos para no repetir el nombre.
                  </p>
                  <div className="grid grid-cols-[1fr_88px] gap-3">
                    <Field label="Estilo del número">
                      <Select
                        items={numberStyleItems(rule.rename.name)}
                        value={rule.rename.style}
                        onValueChange={(v) => set("rename", { style: (v ?? "underscore") as NumberStyle })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(numberStyleItems(rule.rename.name)).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Empezar en">
                      <Input
                        type="number"
                        min={0}
                        value={rule.rename.start}
                        onChange={(e) => set("rename", { start: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="replace" className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Buscar">
                  <Input
                    value={rule.replace.find}
                    onChange={(e) => set("replace", { find: e.target.value })}
                    placeholder="ej. borrador"
                    aria-invalid={regexError || undefined}
                  />
                </Field>
                <Field label="Reemplazar por">
                  <Input
                    value={rule.replace.with}
                    onChange={(e) => set("replace", { with: e.target.value })}
                    placeholder="ej. final"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <CheckField id="mc" checked={rule.replace.matchCase} onChange={(v) => set("replace", { matchCase: v })}>
                  Distinguir mayúsculas
                </CheckField>
                <CheckField id="rx" checked={rule.replace.regex} onChange={(v) => set("replace", { regex: v })}>
                  Expresión regular
                </CheckField>
              </div>
              {regexError && (
                <p className="text-xs text-brand-magenta">La expresión regular no es válida.</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Deja "Reemplazar por" vacío para borrar el texto.
              </p>
            </TabsContent>

            <TabsContent value="affix" className="grid grid-cols-2 gap-3">
              <Field label="Al inicio (prefijo)">
                <Input
                  value={rule.affix.prefix}
                  onChange={(e) => set("affix", { prefix: e.target.value })}
                  placeholder="ej. 2025 - "
                />
              </Field>
              <Field label="Al final (sufijo)">
                <Input
                  value={rule.affix.suffix}
                  onChange={(e) => set("affix", { suffix: e.target.value })}
                  placeholder="ej. (revisado)"
                />
              </Field>
            </TabsContent>

            <TabsContent value="number" className="grid gap-3">
              <Field
                label="Patrón del nombre"
                hint={
                  <>
                    Usa <code className="rounded bg-muted px-1">{"{n}"}</code> para el número,{" "}
                    <code className="rounded bg-muted px-1">{"{nombre}"}</code> para el nombre actual y{" "}
                    <code className="rounded bg-muted px-1">{"{fecha}"}</code> para la fecha de modificación.
                  </>
                }
              >
                <Input
                  value={rule.number.pattern}
                  onChange={(e) => set("number", { pattern: e.target.value })}
                  placeholder="Foto evento {n}"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Empezar en">
                  <Input
                    type="number"
                    min={0}
                    value={rule.number.start}
                    onChange={(e) => set("number", { start: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </Field>
                <Field label="Dígitos">
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    value={rule.number.digits}
                    onChange={(e) =>
                      set("number", { digits: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })
                    }
                  />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="format" className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mayúsculas">
                  <Select
                    items={CASE_OPTIONS}
                    value={rule.format.textCase}
                    onValueChange={(v) => set("format", { textCase: (v ?? "keep") as RenameRule["format"]["textCase"] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CASE_OPTIONS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Separar palabras con">
                  <Select
                    items={SEPARATOR_OPTIONS}
                    value={rule.format.separator}
                    onValueChange={(v) => set("format", { separator: (v ?? "keep") as RenameRule["format"]["separator"] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SEPARATOR_OPTIONS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <CheckField id="acc" checked={rule.format.removeAccents} onChange={(v) => set("format", { removeAccents: v })}>
                  Quitar tildes
                </CheckField>
                <CheckField id="sp" checked={rule.format.collapseSpaces} onChange={(v) => set("format", { collapseSpaces: v })}>
                  Quitar espacios de más
                </CheckField>
              </div>
            </TabsContent>

            <TabsContent value="manual">
              <p className="text-xs text-muted-foreground">
                Escribe el nombre nuevo de cada archivo directamente en la vista previa.
              </p>
            </TabsContent>

            <div className={cn("flex items-center justify-between rounded-lg bg-muted/70 px-3 py-2", !showMore && "hidden")}>
              <Label htmlFor="keep-ext" className="text-sm font-normal">
                Conservar la extensión <span className="text-muted-foreground">(.pdf, .jpg…)</span>
              </Label>
              <Switch
                id="keep-ext"
                checked={rule.keepExtension}
                onCheckedChange={(v) => onRule({ ...rule, keepExtension: v })}
              />
            </div>
          </div>
        </Tabs>

        {/* Vista previa */}
        <div className="border-t">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Vista previa</p>
            {!empty && (
              <p className="text-xs text-muted-foreground tabular-nums">
                <span className="font-medium text-success">{applicable} cambiarán</span>
                {issues > 0 && <span className="text-warning"> · {issues} con aviso</span>}
              </p>
            )}
          </div>
          {empty ? (
            <div className="flex flex-col items-center px-6 pt-4 pb-8 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-secondary text-primary">
                <MousePointerClickIcon className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium">Selecciona archivos de la lista</p>
              <p className="text-xs text-muted-foreground">
                Puedes marcar uno, varios o todos los resultados de una búsqueda.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5 px-3 pb-3">
              {preview.map((p) => (
                <PreviewRow key={p.file.id} item={p} rule={rule} onRule={onRule} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t bg-white p-4">
        {applying ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Loader2Icon className="size-4 animate-spin text-primary" />
                Aplicando cambios…
              </span>
              <span className="text-muted-foreground tabular-nums">
                {applying.done} / {applying.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(applying.done / applying.total) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <Button className="h-10 w-full text-[15px]" disabled={!applicable || regexError} onClick={onApply}>
            {applicable
              ? `Renombrar ${applicable} ${applicable === 1 ? "archivo" : "archivos"}`
              : "Renombrar"}
          </Button>
        )}
      </div>
    </aside>
  )
}

function PreviewRow({
  item,
  rule,
  onRule,
}: {
  item: PreviewItem
  rule: RenameRule
  onRule: (r: RenameRule) => void
}) {
  const { file, newName, status } = item
  const badge = STATUS[status]
  const changes = status !== "same" && status !== "invalid"

  if (rule.mode === "nomen") {
    return <NomenPreviewRow item={item} rule={rule} onRule={onRule} />
  }

  if (rule.mode === "manual") {
    const { base, ext } = rule.keepExtension ? splitName(file) : { base: file.name, ext: "" }
    const value = rule.manual[file.id] ?? base
    return (
      <li className="rounded-lg border px-3 py-2">
        <div className="flex items-center gap-2">
          <FileKindIcon kind={file.kind} className="size-6 rounded-md [&_svg]:size-3.5" />
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={file.name}>
            {file.name}
          </p>
          {badge && <StatusBadge {...badge} status={status} />}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <Input
            value={value}
            disabled={!file.canRename}
            onChange={(e) => onRule({ ...rule, manual: { ...rule.manual, [file.id]: e.target.value } })}
            className="h-8 text-sm"
          />
          {ext && <span className="shrink-0 text-xs text-muted-foreground">{ext}</span>}
        </div>
      </li>
    )
  }

  return (
    <li className="rounded-lg px-2 py-2 hover:bg-muted/50">
      <div className="flex items-start gap-2.5">
        <FileKindIcon kind={file.kind} className="mt-0.5 size-6 rounded-md [&_svg]:size-3.5" />
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-xs ${changes ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-muted-foreground"}`}
            title={file.name}
          >
            {file.name}
          </p>
          {changes && (
            <p className="flex items-start gap-1 text-sm font-medium" title={newName}>
              <ArrowRightIcon className="mt-0.5 size-3.5 shrink-0 text-brand-teal" />
              <span className="min-w-0 break-all">{newName || "—"}</span>
            </p>
          )}
        </div>
        {badge && <StatusBadge {...badge} status={status} />}
      </div>
    </li>
  )
}

function StatusBadge({ label, className, status }: { label: string; className: string; status: PreviewStatus }) {
  return (
    <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {status === "locked" && <LockIcon className="size-3" />}
      {(status === "duplicate" || status === "empty") && <TriangleAlertIcon className="size-3" />}
      {label}
    </span>
  )
}

const DATE_INPUT: Record<"day" | "month" | "year" | "period", { type: string; placeholder?: string }> = {
  day: { type: "date" },
  month: { type: "month" },
  year: { type: "number", placeholder: "AAAA" },
  // semestre o rango: no hay calendario para eso, se escribe
  period: { type: "text", placeholder: "2026-S1" },
}

const DATE_SOURCE_HINT = {
  file: { text: "Fecha del archivo: revísala", className: "text-warning" },
  name: { text: "Fecha tomada del nombre", className: "text-muted-foreground" },
  global: { text: "Fecha elegida para todos", className: "text-muted-foreground" },
  manual: { text: "Fecha corregida", className: "text-success" },
  none: null,
} as const

/** Fila de vista previa en Nomenclatura: cada archivo con su descripción y fecha editables */
function NomenPreviewRow({
  item,
  rule,
  onRule,
}: {
  item: PreviewItem
  rule: RenameRule
  onRule: (r: RenameRule) => void
}) {
  const { file, newName, status } = item
  const nomen = rule.nomen
  const override = nomen.perFile[file.id] ?? {}
  const base = splitName(file).base
  const parts = nomenParts(base, file.modifiedTime, nomen, override)
  const badge = STATUS[status]
  const hint = DATE_SOURCE_HINT[parts.dateSource]
  const dateValue = override.date ?? parts.date
  // En "Actual", el campo se adapta a la fecha que trae el archivo (año, mes o día)
  const inputKind: "day" | "month" | "year" | "period" =
    nomen.precision === "auto"
      ? isPeriod(parts.date) || /^\d{4}-(S|\d{3})/i.test(override.date ?? "")
        ? "period"
        : dateValue.length === 4
        ? "year"
        : dateValue.length === 7
          ? "month"
          : "day"
      : nomen.precision === "none"
        ? "day"
        : nomen.precision
  // Si falta algún dato, se muestra la sugerencia con huecos para que se vea qué completar
  const shownName =
    status === "incomplete"
      ? [
          parts.bloque || "¿BLOQUE?",
          parts.tipo || "¿TIPO?",
          parts.date,
          parts.description || "¿Descripción?",
          parts.version,
        ]
          .filter(Boolean)
          .join("_") + splitName(file).ext
      : newName
  const showDate = nomen.precision !== "none" && (nomen.precision !== "auto" || !!dateValue)
  const incompleteDate =
    !!override.date &&
    (inputKind === "period"
      ? !isPeriod(override.date)
      : override.date.length < DATE_LEN[inputKind])

  const setOverride = (patch: Partial<typeof override>) =>
    onRule({
      ...rule,
      nomen: { ...nomen, perFile: { ...nomen.perFile, [file.id]: { ...override, ...patch } } },
    })

  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5",
        status === "change" && "border-border",
        (status === "incomplete" || status === "duplicate" || status === "locked") && "border-warning/40 bg-warning-soft/30"
      )}
    >
      <div className="flex items-start gap-2">
        <FileKindIcon kind={file.kind} className="mt-0.5 size-6 rounded-md [&_svg]:size-3.5" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground" title={file.name}>
            {file.name}
          </p>
          <p className="flex items-start gap-1 text-[13px] font-medium" title={shownName}>
            <ArrowRightIcon className="mt-0.5 size-3.5 shrink-0 text-brand-teal" />
            <span
              className={cn("min-w-0 font-mono break-all", status === "incomplete" && "text-muted-foreground")}
            >
              {shownName}
            </span>
          </p>
        </div>
        {badge && <StatusBadge {...badge} label={item.note ?? badge.label} status={status} />}
      </div>

      {file.canRename && status !== "same" && (
        <div
          className={cn(
            "mt-2 grid gap-2 pl-8",
            showDate && "grid-cols-[minmax(0,1fr)_minmax(0,128px)]"
          )}
        >
          <div className="grid gap-0.5">
            <Input
              value={override.description ?? parts.description}
              onChange={(e) => setOverride({ description: e.target.value })}
              placeholder="Descripción, ej. jornada de siembra"
              aria-label={`Descripción de ${file.name}`}
              className={cn("h-8 text-sm", !parts.description && "border-warning")}
            />
            <span className="text-[10px] text-muted-foreground">Descripción</span>
          </div>
          {showDate && (
            <div className="grid gap-0.5">
              <Input
                {...DATE_INPUT[inputKind]}
                value={dateValue}
                min={inputKind === "year" ? 1990 : undefined}
                max={inputKind === "year" ? 2100 : undefined}
                onChange={(e) => setOverride({ date: e.target.value })}
                aria-label={`Fecha de ${file.name}`}
                className={cn("h-8 px-2 text-sm", parts.dateSource === "file" && "border-warning")}
              />
              {hint && <span className={cn("text-[10px]", hint.className)}>{hint.text}</span>}
            </div>
          )}
        </div>
      )}
      {incompleteDate && (
        <p className="mt-1 pl-8 text-[10px] text-warning">Completa la fecha.</p>
      )}
    </li>
  )
}
