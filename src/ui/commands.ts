import { toast } from "sonner"
import { readableText } from "@/domain/color"
import { fitRange } from "@/domain/document"
import { THEME_PRESETS } from "@/domain/presets"
import type { Appearance, DocumentSettings, ScheduleDocument } from "@/domain/types"
import { copyBlock, deleteBlock, startDuplicate, startPaste } from "@/state/actions"
import { useEditor } from "@/state/editor"
import { commit, useStudio } from "@/state/studio"
import { mod } from "./platform"

export type MenuEntry =
  | { type: "item"; id: string; label: string; shortcut?: string; disabled?: boolean; run: () => void; keywords?: string[]; checked?: boolean; destructive?: boolean }
  | { type: "separator" }
  | { type: "submenu"; id: string; label: string; items: MenuEntry[] }
  | { type: "radio"; id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }

export type Menu = { id: string; label: string; items: MenuEntry[] }

const shift = "⇧"

export function setZoom(next: number) {
  useEditor.getState().set({ zoom: Math.min(4, Math.max(0.1, Math.round(next * 100) / 100)), fit: false })
}

export function zoomBy(factor: number) {
  setZoom(useEditor.getState().zoom * factor)
}

export function toggleShow(key: keyof DocumentSettings["show"], label: string) {
  commit(`${label}`, (doc) => ({ ...doc, settings: { ...doc.settings, show: { ...doc.settings.show, [key]: !doc.settings.show[key] } } }))
}

/** Applies a look as one operation; subjects keep their colors unless the palette is explicitly applied. */
export function applyAppearance(appearance: Appearance, options: { label: string; recolor?: boolean }) {
  commit(options.label, (doc: ScheduleDocument) => {
    const next = { ...doc, appearance: structuredClone(appearance) }
    if (options.recolor) {
      next.subjects = doc.subjects.map((subject, index) => {
        const color = appearance.palette[index % appearance.palette.length]!
        return { ...subject, color, textColor: readableText(color) }
      })
    }
    return next
  })
}

export function fitRangeToBlocks() {
  const doc = useStudio.getState().session?.doc
  if (!doc) return
  if (!doc.blocks.length) {
    toast("Todavía no hay clases para ajustar el rango.")
    return
  }
  const range = fitRange(doc.blocks)
  if (range.start === doc.settings.range.start && range.end === doc.settings.range.end) {
    toast("El rango ya se ajusta a tus clases.")
    return
  }
  commit("Ajustar rango a las clases", (current) => ({ ...current, settings: { ...current.settings, range } }), { announce: "Rango ajustado a tus clases" })
}

export function useMenus(): Menu[] {
  const session = useStudio((state) => state.session)
  const themes = useStudio((state) => state.themes)
  const prefs = useStudio((state) => state.prefs)
  const selectedBlockId = useEditor((state) => state.selectedBlockId)
  const clipboard = useEditor((state) => state.clipboard)
  const tool = useEditor((state) => state.tool)
  const armed = useEditor((state) => state.armedSubjectId)
  const studio = useStudio.getState()
  const editor = useEditor.getState()
  const doc = session?.doc
  const hasDoc = !!doc
  const hasBlock = !!doc && !!selectedBlockId && doc.blocks.some((block) => block.id === selectedBlockId)
  const lastUndo = session?.past.at(-1)?.label
  const nextRedo = session?.future[0]?.label

  return [
    {
      id: "file",
      label: "Archivo",
      items: [
        { type: "item", id: "new", label: "Nuevo proyecto…", run: () => editor.openDialog("new-project"), keywords: ["crear", "horario"] },
        { type: "item", id: "projects", label: "Mis proyectos…", shortcut: `${mod}O`, run: () => editor.openDialog("projects"), keywords: ["abrir", "papelera"] },
        { type: "item", id: "duplicate-project", label: "Duplicar proyecto", disabled: !hasDoc, run: () => doc && void studio.duplicateProject(doc.id) },
        { type: "item", id: "import", label: "Importar…", run: () => editor.openDialog("import"), keywords: ["abrir archivo", "json", "copia"] },
        { type: "separator" },
        { type: "item", id: "export", label: "Exportar imagen…", shortcut: `${mod}${shift}E`, disabled: !hasDoc, run: () => editor.openDialog("export"), keywords: ["png", "svg", "descargar"] },
        { type: "item", id: "download-json", label: "Descargar proyecto (JSON)", disabled: !hasDoc, run: () => studio.downloadProject(), keywords: ["exportar", "editable"] },
        { type: "item", id: "backup", label: "Descargar copia de seguridad", run: () => void studio.downloadBackup(), keywords: ["respaldo", "backup"] },
        { type: "separator" },
        { type: "item", id: "save", label: "Guardar ahora", shortcut: `${mod}S`, disabled: !hasDoc, run: () => void studio.saveNow().then((ok) => (ok ? toast.success("Guardado en este navegador") : toast.error("No se pudo guardar"))) },
        { type: "item", id: "close", label: "Cerrar proyecto", disabled: !hasDoc, run: () => void studio.closeProject() },
      ],
    },
    {
      id: "edit",
      label: "Editar",
      items: [
        { type: "item", id: "undo", label: lastUndo ? `Deshacer: ${lastUndo}` : "Deshacer", shortcut: `${mod}Z`, disabled: !lastUndo, run: () => studio.undo() },
        { type: "item", id: "redo", label: nextRedo ? `Rehacer: ${nextRedo}` : "Rehacer", shortcut: `${mod}${shift}Z`, disabled: !nextRedo, run: () => studio.redo() },
        { type: "separator" },
        { type: "item", id: "copy", label: "Copiar bloque", shortcut: `${mod}C`, disabled: !hasBlock, run: () => selectedBlockId && copyBlock(selectedBlockId) },
        { type: "item", id: "paste", label: "Pegar bloque", shortcut: `${mod}V`, disabled: !hasDoc || !clipboard, run: () => clipboard && startPaste(clipboard) },
        { type: "item", id: "duplicate", label: "Duplicar bloque", shortcut: `${mod}D`, disabled: !hasBlock, run: () => selectedBlockId && startDuplicate(selectedBlockId) },
        { type: "item", id: "delete", label: "Eliminar bloque", shortcut: "Supr", disabled: !hasBlock, destructive: true, run: () => selectedBlockId && deleteBlock(selectedBlockId) },
        { type: "separator" },
        { type: "item", id: "new-subject", label: "Nueva materia…", disabled: !hasDoc, run: () => editor.openDialog("subject"), keywords: ["agregar materia"] },
        { type: "item", id: "block-form", label: "Agregar bloque con formulario…", disabled: !hasDoc || !doc?.subjects.length, run: () => editor.openDialog("block-form"), keywords: ["nueva clase", "teclado"] },
      ],
    },
    {
      id: "view",
      label: "Ver",
      items: [
        { type: "item", id: "panel-library", label: "Panel de materias", checked: prefs.libraryOpen, run: () => studio.setPrefs({ libraryOpen: !prefs.libraryOpen }) },
        { type: "item", id: "panel-inspector", label: "Panel de propiedades", checked: prefs.inspectorOpen, run: () => studio.setPrefs({ inspectorOpen: !prefs.inspectorOpen }) },
        { type: "item", id: "blocks-list", label: "Lista de clases", disabled: !hasDoc, run: () => {
          editor.set({ leftTab: "blocks" })
          studio.setPrefs({ libraryOpen: true })
          if (window.matchMedia("(max-width: 767px)").matches) editor.set({ mobileSheet: "library" })
        } },
        { type: "separator" },
        { type: "item", id: "tool-select", label: "Herramienta Seleccionar", shortcut: "V", checked: tool === "select", disabled: !hasDoc, run: () => editor.set({ tool: "select", hover: null }) },
        { type: "item", id: "tool-place", label: "Herramienta Colocar", shortcut: "B", checked: tool === "place", disabled: !hasDoc || !doc?.subjects.length, run: () => editor.arm(armed ?? doc?.subjects[0]?.id ?? null) },
        { type: "separator" },
        { type: "item", id: "zoom-in", label: "Acercar", shortcut: `${mod}+`, disabled: !hasDoc, run: () => zoomBy(1.25) },
        { type: "item", id: "zoom-out", label: "Alejar", shortcut: `${mod}−`, disabled: !hasDoc, run: () => zoomBy(0.8) },
        { type: "item", id: "zoom-fit", label: "Ajustar a la ventana", shortcut: `${mod}0`, disabled: !hasDoc, run: () => editor.set({ fit: true }) },
        { type: "item", id: "zoom-100", label: "Tamaño real", shortcut: `${mod}1`, disabled: !hasDoc, run: () => setZoom(1) },
        { type: "separator" },
        {
          type: "radio",
          id: "ui-theme",
          label: "Interfaz",
          value: prefs.uiTheme,
          options: [
            { value: "system", label: "Según el sistema" },
            { value: "light", label: "Clara" },
            { value: "dark", label: "Oscura" },
          ],
          onChange: (value) => studio.setPrefs({ uiTheme: value as typeof prefs.uiTheme }),
        },
      ],
    },
    {
      id: "document",
      label: "Documento",
      items: [
        { type: "item", id: "settings", label: "Ajustes del documento…", shortcut: `${mod},`, disabled: !hasDoc, run: () => editor.openDialog("settings"), keywords: ["título", "tamaño", "días", "rango", "horas"] },
        { type: "item", id: "fit-range", label: "Ajustar rango a mis clases", disabled: !hasDoc, run: fitRangeToBlocks },
        { type: "separator" },
        { type: "item", id: "show-legend", label: "Mostrar leyenda", checked: doc?.settings.show.legend, disabled: !hasDoc, run: () => toggleShow("legend", doc?.settings.show.legend ? "Ocultar leyenda" : "Mostrar leyenda") },
        { type: "item", id: "show-hours", label: "Mostrar horas de la grilla", checked: doc?.settings.show.hourLabels, disabled: !hasDoc, run: () => toggleShow("hourLabels", "Cambiar horas de la grilla") },
        { type: "item", id: "show-times", label: "Mostrar horario en cada bloque", checked: doc?.settings.show.blockTimes, disabled: !hasDoc, run: () => toggleShow("blockTimes", "Cambiar horario en bloques") },
        { type: "item", id: "show-room", label: "Mostrar aula", checked: doc?.settings.show.room, disabled: !hasDoc, run: () => toggleShow("room", "Cambiar visibilidad de aula") },
        { type: "item", id: "show-kind", label: "Mostrar tipo de clase", checked: doc?.settings.show.kind, disabled: !hasDoc, run: () => toggleShow("kind", "Cambiar visibilidad de tipo") },
        { type: "item", id: "show-notes", label: "Mostrar notas", checked: doc?.settings.show.notes, disabled: !hasDoc, run: () => toggleShow("notes", "Cambiar visibilidad de notas") },
        { type: "item", id: "show-subtitle", label: "Mostrar subtítulo", checked: doc?.settings.show.subtitle, disabled: !hasDoc, run: () => toggleShow("subtitle", "Cambiar visibilidad del subtítulo") },
      ],
    },
    {
      id: "theme",
      label: "Tema",
      items: [
        { type: "item", id: "appearance", label: "Personalizar apariencia…", shortcut: `${mod}${shift}A`, disabled: !hasDoc, run: () => editor.openDialog("appearance"), keywords: ["colores", "fuentes", "tipografía", "tema"] },
        {
          type: "submenu",
          id: "apply-theme",
          label: "Aplicar tema",
          items: [
            ...THEME_PRESETS.map((preset): MenuEntry => ({
              type: "item",
              id: `preset-${preset.id}`,
              label: preset.appearance.name,
              disabled: !hasDoc,
              checked: doc?.appearance.name === preset.appearance.name,
              run: () => applyAppearance(preset.appearance, { label: `Aplicar tema ${preset.appearance.name}` }),
            })),
            ...(themes.length ? [{ type: "separator" } as MenuEntry] : []),
            ...themes.map((theme): MenuEntry => ({
              type: "item",
              id: `theme-${theme.id}`,
              label: theme.name,
              disabled: !hasDoc,
              run: () => applyAppearance({ ...theme.appearance, name: theme.name }, { label: `Aplicar tema ${theme.name}` }),
            })),
          ],
        },
        { type: "item", id: "save-theme", label: "Guardar tema actual…", disabled: !hasDoc, run: () => editor.openDialog("appearance", { tab: "themes", save: true }) },
        { type: "item", id: "manage-themes", label: "Administrar mis temas…", run: () => editor.openDialog("appearance", { tab: "themes" }), disabled: !hasDoc },
      ],
    },
    {
      id: "help",
      label: "Ayuda",
      items: [
        { type: "item", id: "commands", label: "Buscar comandos…", shortcut: `${mod}K`, run: () => editor.openDialog("commands") },
        { type: "item", id: "shortcuts", label: "Atajos de teclado", shortcut: "?", run: () => editor.openDialog("shortcuts") },
        { type: "item", id: "about", label: "Guardado y privacidad", run: () => editor.openDialog("about") },
      ],
    },
  ]
}
