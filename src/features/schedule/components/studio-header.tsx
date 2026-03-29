import { Download, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

type StudioHeaderProps = {
  status: string
  onReset: () => void
  onImport: () => void
  onExport: () => void
  onDownload: () => void
}

export function StudioHeader({
  status,
  onReset,
  onImport,
  onExport,
  onDownload,
}: StudioHeaderProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-title">Horario Studio</span>
        <div className="toolbar-sep" />
        <span className="toolbar-status">{status}</span>
      </div>

      <div className="toolbar-actions">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="btn btn-ghost btn-sm"
          onClick={onReset}
          title="Reiniciar horario"
          aria-label="Reiniciar horario"
        >
          <RotateCcw style={{ width: "1rem", height: "1rem" }} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="btn btn-ghost btn-sm"
          onClick={onImport}
          title="Importar JSON"
        >
          Importar JSON
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="btn btn-ghost btn-sm"
          onClick={onExport}
          title="Exportar JSON"
        >
          Exportar JSON
        </Button>
        <Button
          type="button"
          size="sm"
          className="btn btn-primary btn-sm"
          onClick={onDownload}
          title="Descargar PNG"
        >
          <Download style={{ width: "1rem", height: "1rem" }} />
          Descargar
        </Button>
      </div>
    </header>
  )
}
