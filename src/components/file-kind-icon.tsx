import {
  FileArchiveIcon,
  FileIcon,
  FileImageIcon,
  FileMusicIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  PresentationIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { FileKind } from "@/lib/types"

const KINDS: Record<FileKind, { icon: LucideIcon; className: string; label: string }> = {
  folder: { icon: FolderIcon, className: "bg-secondary text-primary", label: "Carpeta" },
  doc: { icon: FileTextIcon, className: "bg-secondary text-primary", label: "Documento" },
  sheet: { icon: FileSpreadsheetIcon, className: "bg-success-soft text-success", label: "Hoja de cálculo" },
  slides: { icon: PresentationIcon, className: "bg-warning-soft text-warning", label: "Presentación" },
  pdf: { icon: FileTextIcon, className: "bg-danger-soft text-brand-magenta", label: "PDF" },
  image: { icon: FileImageIcon, className: "bg-[#FFF6CC] text-[#8A6A00]", label: "Imagen" },
  video: { icon: FileVideoIcon, className: "bg-danger-soft text-brand-magenta", label: "Video" },
  audio: { icon: FileMusicIcon, className: "bg-success-soft text-success", label: "Audio" },
  zip: { icon: FileArchiveIcon, className: "bg-muted text-muted-foreground", label: "Comprimido" },
  other: { icon: FileIcon, className: "bg-muted text-muted-foreground", label: "Archivo" },
}

export const KIND_LABELS = Object.fromEntries(
  Object.entries(KINDS).map(([k, v]) => [k, v.label])
) as Record<FileKind, string>

export function FileKindIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const { icon: Icon, className: tone } = KINDS[kind]
  return (
    <span
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone, className)}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  )
}
