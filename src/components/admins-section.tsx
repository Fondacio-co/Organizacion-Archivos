import { useState } from "react"
import { Loader2Icon, ShieldCheckIcon, UserMinusIcon, UserPlusIcon } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { isEmail } from "@/lib/catalog"
import type { CatalogAdmin } from "@/lib/types"

/** Lista de administradores de los códigos, con opción de agregar y quitar */
export function AdminsSection({
  admins,
  currentEmail,
  domain,
  onAdd,
  onRemove,
}: {
  /** null = cargando */
  admins: CatalogAdmin[] | null
  currentEmail: string
  /** Dominio de la organización (solo esas cuentas pueden entrar a la página) */
  domain: string | null
  onAdd: (email: string) => Promise<boolean>
  onRemove: (admin: CatalogAdmin) => Promise<void>
}) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [toRemove, setToRemove] = useState<CatalogAdmin | null>(null)
  const [removing, setRemoving] = useState(false)

  const add = async () => {
    const clean = email.trim().toLowerCase()
    if (!isEmail(clean)) return setError("Escribe un correo válido.")
    if (domain && !clean.endsWith(`@${domain}`))
      return setError(`Debe ser una cuenta @${domain}: solo esas pueden entrar a la página.`)
    if (admins?.some((a) => a.email.toLowerCase() === clean)) return setError("Esa persona ya es administradora.")
    setError(null)
    setAdding(true)
    try {
      if (await onAdd(clean)) setEmail("")
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheckIcon className="size-4 text-primary" /> Administradores
          </h2>
          <p className="text-xs text-muted-foreground">
            Pueden crear, editar y eliminar códigos, y agregar o quitar administradores.
          </p>
        </div>
      </div>

      <ul className="divide-y">
        {admins === null
          ? Array.from({ length: 2 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3.5 w-56" />
              </li>
            ))
          : admins.map((a) => {
              const you = a.email.toLowerCase() === currentEmail.toLowerCase()
              return (
                <li key={a.permissionId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary uppercase">
                    {(a.name || a.email).slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.name || a.email}
                      {you && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(tú)</span>}
                    </p>
                    {a.name && <p className="truncate text-xs text-muted-foreground">{a.email}</p>}
                  </div>
                  {a.kind === "owner" && <Badge variant="outline">Propietaria del archivo</Badge>}
                  {a.kind === "inherited" && <Badge variant="outline">Por la unidad compartida</Badge>}
                  {a.kind === "editor" && !you && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-brand-magenta hover:bg-danger-soft hover:text-brand-magenta"
                      onClick={() => setToRemove(a)}
                    >
                      <UserMinusIcon /> Quitar
                    </Button>
                  )}
                </li>
              )
            })}
      </ul>

      <form
        className="grid gap-1.5 border-t bg-muted/40 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label htmlFor="new-admin" className="text-xs font-medium text-muted-foreground">
          Agregar administrador
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="new-admin"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            placeholder={domain ? `nombre@${domain}` : "correo@ejemplo.com"}
            className="h-9 flex-1 bg-white"
          />
          <Button type="submit" disabled={adding || !email.trim()} className="h-9">
            {adding ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
            Agregar
          </Button>
        </div>
        {error ? (
          <p className="text-xs text-brand-magenta">{error}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Se le comparte el archivo de códigos como Editor en Drive y Google le avisa por correo.
          </p>
        )}
      </form>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && !removing && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {toRemove?.name || toRemove?.email} como administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Seguirá pudiendo usar la página y ver los códigos, pero ya no podrá crearlos, editarlos ni eliminarlos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              className="bg-brand-magenta text-white hover:bg-brand-magenta/90"
              onClick={async () => {
                if (!toRemove) return
                setRemoving(true)
                try {
                  await onRemove(toRemove)
                  setToRemove(null)
                } finally {
                  setRemoving(false)
                }
              }}
            >
              {removing && <Loader2Icon className="animate-spin" />}
              Sí, quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
