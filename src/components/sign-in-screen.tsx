import { EyeIcon, Loader2Icon, SearchIcon, ShieldCheckIcon, WandSparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BrandMark } from "./app-header"

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

const FEATURES = [
  { icon: SearchIcon, tone: "bg-secondary text-primary", title: "Busca al instante", text: "Por nombre o tipo, dentro de la carpeta y sus subcarpetas." },
  { icon: WandSparklesIcon, tone: "bg-warning-soft text-warning", title: "Renombra en lote", text: "Reemplaza texto, numera, agrega prefijos o limpia el formato." },
  { icon: EyeIcon, tone: "bg-success-soft text-success", title: "Revisa antes de aplicar", text: "Ves cada nombre nuevo y puedes deshacer los cambios." },
]

export function SignInScreen({
  demo,
  loading,
  onSignIn,
}: {
  demo: boolean
  loading: boolean
  onSignIn: () => void
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-14 text-center sm:py-20">
      <BrandMark size="lg" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Organiza y nombra los archivos de tu Google Drive
      </h1>
      <p className="mt-3 text-base text-pretty text-muted-foreground">
        Conecta tu cuenta de Google, elige una carpeta (también en unidades compartidas) y cambia
        el nombre de uno o muchos archivos a la vez.
      </p>

      <Button size="lg" className="mt-8 h-11 gap-2.5 px-5 text-[15px]" onClick={onSignIn} disabled={loading}>
        {loading ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <span className="grid size-6 place-items-center rounded-full bg-white">
            <GoogleLogo />
          </span>
        )}
        {demo ? "Entrar a la demostración" : "Iniciar sesión con Google"}
      </Button>
      {demo && (
        <p className="mt-3 max-w-sm text-xs text-muted-foreground">
          Esta es una versión de prueba con archivos de ejemplo. No se conecta a ninguna cuenta.
        </p>
      )}

      <Card className="mt-12 w-full text-left">
        <CardContent className="grid gap-5">
          {FEATURES.map(({ icon: Icon, tone, title, text }) => (
            <div key={title} className="flex gap-3.5">
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}>
                <Icon className="size-[18px]" />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheckIcon className="size-3.5" />
        Solo ves las carpetas a las que tu cuenta tiene acceso. Nada cambia sin tu confirmación.
      </p>
    </div>
  )
}
