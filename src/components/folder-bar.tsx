import {
  ExternalLinkIcon,
  FolderOpenIcon,
  HardDriveIcon,
  RefreshCwIcon,
  UsersIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { FolderInfo, ScanProgress } from "@/lib/types"

export function FolderBar({
  folder,
  fileCount,
  scanning,
  progress,
  onRefresh,
  onChange,
}: {
  folder: FolderInfo
  fileCount: number
  scanning: boolean
  progress: ScanProgress | null
  onRefresh: () => void
  onChange: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
        <FolderOpenIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{folder.name}</p>
          {folder.sharedDriveName ? (
            <Badge variant="outline" className="gap-1 border-brand-teal/40 text-success">
              <UsersIcon />
              {folder.sharedDriveName}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <HardDriveIcon />
              Mi unidad
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {folder.location && folder.location !== folder.name ? `${folder.location} · ` : ""}
          {scanning
            ? `Leyendo… ${progress?.folders ?? 0} carpetas · ${progress?.files ?? 0} archivos`
            : `${fileCount.toLocaleString("es")} archivos en esta carpeta y sus subcarpetas`}
        </p>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {folder.webViewLink && (
          <Button
            variant="ghost"
            size="sm"
            render={<a href={folder.webViewLink} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            <ExternalLinkIcon />
            <span className="hidden sm:inline">Abrir en Drive</span>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={scanning}>
          <RefreshCwIcon className={scanning ? "animate-spin" : ""} />
          Actualizar
        </Button>
        <Button variant="outline" size="sm" onClick={onChange} disabled={scanning}>
          Otra carpeta
        </Button>
      </div>
    </div>
  )
}
