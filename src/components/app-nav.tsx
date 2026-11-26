import { FolderTreeIcon, HistoryIcon, PenLineIcon, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type View = "folders" | "rename" | "history"

const ITEMS: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "folders", label: "Carpetas", icon: FolderTreeIcon },
  { view: "rename", label: "Renombrar", icon: PenLineIcon },
  { view: "history", label: "Historial", icon: HistoryIcon },
]

export function AppNav({
  view,
  onView,
  folderName,
  historyCount,
}: {
  view: View
  onView: (v: View) => void
  folderName?: string
  historyCount: number
}) {
  return (
    <nav className="flex h-full items-stretch gap-1" aria-label="Secciones">
      {ITEMS.map(({ view: v, label, icon: Icon }) => {
        const disabled = v === "rename" && !folderName
        const active = view === v && !disabled
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onView(v)}
            aria-current={active ? "page" : undefined}
            title={disabled ? "Primero elige una carpeta" : v === "rename" ? folderName : undefined}
            className={cn(
              "relative flex items-center gap-2 px-3 text-sm font-medium transition-colors",
              "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity",
              active ? "text-primary after:opacity-100" : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-45 hover:text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
            {v === "history" && historyCount > 0 && (
              <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-brand-magenta px-1 text-[10px] font-semibold text-white tabular-nums">
                {historyCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
