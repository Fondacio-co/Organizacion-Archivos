import { CircleHelpIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Catalog } from "@/lib/catalog"

/** Botón "¿Qué significa cada código?" con la guía completa de la nomenclatura */
export function CodesLegend({ catalog }: { catalog: Catalog }) {
  return (
    <Dialog>
      <DialogTrigger className="flex items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline">
        <CircleHelpIcon className="size-3.5" />
        Ver códigos
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cómo se nombran los archivos</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-foreground">BLOQUE_TIPO_FECHA_Descripcion_Version</span>
            <br />
            Ejemplo: <span className="font-mono">CAM_IAC_2026-05-30_JornadaSiembra_v01</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr]">
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Bloque · quién lo produce
            </h3>
            <ul className="grid gap-1">
              {catalog.bloques.map(({ code, ...b }) => (
                <li key={code} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 odd:bg-muted/60">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                  <b className="w-10 font-mono text-sm" style={{ color: b.color }}>
                    {code}
                  </b>
                  <span className="text-sm">{b.label}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Tipo · qué clase de documento es
            </h3>
            <ul className="grid gap-1">
              {catalog.tipos.map(({ code, label, color, sinFecha }) => (
                <li key={code} className="flex items-start gap-2.5 rounded-md px-2 py-1.5 odd:bg-muted/60">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <b className="w-10 shrink-0 font-mono text-sm" style={{ color }}>
                    {code}
                  </b>
                  <span className="text-sm">
                    {label}
                    {sinFecha && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(sin fecha)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <ul className="grid gap-1.5 rounded-lg bg-secondary/60 p-3 text-sm">
          <li>
            <b>Fecha:</b> año, año-mes o año-mes-día con guiones (2026, 2026-05, 2026-05-30). Para
            periodos: semestre (2026-S1, 2026-S2) o rango de años (2024-2026).
          </li>
          <li>
            <b>Descripción:</b> el tema, corto, sin espacios ni tildes y con mayúscula en cada palabra
            (JornadaSiembra). La página la arma sola.
          </li>
          <li>
            <b>Versión:</b> v01, v02… o FINAL cuando está aprobado.
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
