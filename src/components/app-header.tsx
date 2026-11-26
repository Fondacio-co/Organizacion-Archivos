import type { ReactNode } from "react"
import { FolderSearchIcon, LogOutIcon, UserRoundCogIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserInfo } from "@/lib/types"

export function BrandStripe() {
  return (
    <div className="flex h-1 w-full" aria-hidden>
      <span className="flex-[4] bg-brand-indigo" />
      <span className="flex-1 bg-brand-teal" />
      <span className="flex-1 bg-brand-yellow" />
      <span className="flex-1 bg-brand-orange" />
      <span className="flex-1 bg-brand-magenta" />
    </div>
  )
}

export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-14 rounded-2xl" : "size-9 rounded-xl"
  const icon = size === "lg" ? "size-7" : "size-5"
  return (
    <span className={`relative grid shrink-0 place-items-center bg-primary text-white ${box}`}>
      <FolderSearchIcon className={icon} />
      <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-brand-yellow ring-2 ring-white" />
    </span>
  )
}

function initials(user: UserInfo) {
  const src = user.name || user.email
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}

export function AppHeader({
  user,
  demo,
  onSwitchAccount,
  onSignOut,
  nav,
}: {
  user: UserInfo | null
  demo: boolean
  onSwitchAccount: () => void
  onSignOut: () => void
  nav?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
      <BrandStripe />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <BrandMark />
        <div className="min-w-0 flex-1 sm:flex-none">
          <p className="font-semibold leading-tight tracking-tight truncate sm:whitespace-nowrap">Organización de Archivos</p>
          <p className="hidden text-xs whitespace-nowrap text-muted-foreground sm:block">
            Ordena y nombra tus archivos de Drive
          </p>
        </div>
        {demo && (
          <Badge className="ml-1 hidden bg-brand-yellow text-brand-ink sm:inline-flex" title="Datos de ejemplo, no se conecta a Google">
            Demostración
          </Badge>
        )}
        {nav && <div className="ml-6 hidden h-full lg:block">{nav}</div>}
        <div className="ml-auto">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full border bg-white py-1 pr-3 pl-1 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40">
                <Avatar className="size-7">
                  {user.picture && <AvatarImage src={user.picture} alt="" />}
                  <AvatarFallback className="bg-secondary text-[11px] font-semibold text-primary">
                    {initials(user)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-56 truncate sm:inline">{user.email}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <span className="block text-xs text-muted-foreground">Conectado como</span>
                    <span className="block truncate font-medium text-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSwitchAccount}>
                  <UserRoundCogIcon />
                  Cambiar de cuenta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSignOut} variant="destructive">
                  <LogOutIcon />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {nav && <div className="h-11 overflow-x-auto border-t px-2 lg:hidden">{nav}</div>}
    </header>
  )
}
