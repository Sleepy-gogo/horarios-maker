// Run on the disposable "Adaptive height verification" fixture, never a real project.
// Reload the dev preview, import tests/fixtures/compact.horario.json, then run:
// await (await import('/tests/browser-checks.mjs')).runBrowserChecks()
export async function browserTools() {
  // Reuse the modules loaded by Vite, including their HMR timestamps, rather than creating a second store.
  const entry = (path) => performance.getEntriesByType("resource").filter((resource) => new URL(resource.name).pathname === path)
    .find((resource) => new URL(resource.name).searchParams.has("t"))?.name ?? new URL(path, location.href).href
  const { useStudio } = await import(/* @vite-ignore */ entry("/src/state/studio.ts"))
  const { useEditor } = await import(/* @vite-ignore */ entry("/src/state/editor.ts"))
  const { renderDocument } = await import(/* @vite-ignore */ entry("/src/engine/render.ts"))
  const { minuteToY, yToMinute } = await import(/* @vite-ignore */ entry("/src/engine/scene.ts"))
  return { useStudio, useEditor, renderDocument, minuteToY, yToMinute }
}

export async function runBrowserChecks(q) {
  q ??= await browserTools()
  const studio = q.useStudio
  const editor = q.useEditor
  const original = studio.getState().session.doc
  if (original.settings.title !== "Adaptive height verification" || !original.settings.compactEmptyHours) {
    throw new Error("Open the compressed verification fixture first.")
  }
  const anchor = original.blocks.find((block) => block.day === "tue" && block.start === 600 && block.end === 720)
  if (!anchor) throw new Error("The verification fixture is missing its 10:00 Tuesday class.")
  const results = []
  q.browserCheckProgress = results
  const check = (condition, name) => {
    if (!condition) throw new Error(name)
    results.push(name)
  }
  // Hidden collaborative previews may suspend animation frames; allow React to flush via tasks too.
  const frame = () => new Promise((resolve) => setTimeout(resolve, 30))
  const stage = () => document.querySelector('[aria-label="Lienzo del horario"]')
  const scene = () => q.renderDocument(studio.getState().session.doc).scene
  const source = () => document.querySelector(`[data-block-id="${anchor.id}"]`)
  const point = (day, minute) => {
    const grid = scene().grid
    const column = grid.columns.find((column) => column.day === day)
    const rect = stage().getBoundingClientRect()
    const zoom = rect.width / original.settings.page.width
    return { clientX: rect.left + (column.x + column.w / 2) * zoom, clientY: rect.top + q.minuteToY(grid, minute) * zoom }
  }
  const center = (element) => {
    const rect = element.getBoundingClientRect()
    return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
  }
  let pointerId = 800
  const pointer = (target, type, at, pointerType = "mouse") => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId, pointerType, button: 0,
    buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1, ...at,
  }))
  const beginMove = async () => {
    pointerId++
    pointer(source(), "pointerdown", center(source()))
    await frame()
    pointer(stage(), "pointermove", point("thu", 840))
    await frame()
  }
  const sameDocument = () => studio.getState().session.doc === original
  const undo = async () => { studio.getState().undo(); await frame() }
  const past = studio.getState().session.past.length
  const baselineSvg = q.renderDocument(original).svg
  editor.getState().set({ tool: "select", candidate: null, hover: null })
  await frame()

  await beginMove()
  check(editor.getState().draft?.interval.start === 780, "drag ghost maps through the compressed band")
  check(sameDocument() && q.renderDocument(studio.getState().session.doc).svg === baselineSvg, "scale and document stay frozen during drag")
  pointer(stage(), "pointerup", point("thu", 840))
  await frame()
  const moved = studio.getState().session.doc.blocks.find((b) => b.id === anchor.id)
  check(moved.day === "thu" && moved.start === 780 && moved.end === 900, "move preserves duration and changes day/time")
  check(studio.getState().session.past.length === past + 1, "one undo entry per gesture")
  await undo()
  check(sameDocument(), "undo restores original document and scale")
  studio.getState().redo()
  await frame()
  check(studio.getState().session.doc.blocks.find((b) => b.id === anchor.id).start === 780, "redo restores the move")
  await undo()

  for (const cancellation of ["Escape", "pointercancel", "resize", "blur", "scroll"]) {
    await beginMove()
    check(!!editor.getState().draft, `draft exists before ${cancellation}`)
    if (cancellation === "Escape") window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    else if (cancellation === "pointercancel") pointer(stage(), "pointercancel", point("thu", 840))
    else window.dispatchEvent(new Event(cancellation))
    await frame()
    pointer(stage(), "pointerup", point("thu", 840))
    await frame()
    check(!editor.getState().draft && sameDocument() && studio.getState().session.past.length === past, `${cancellation} cancels without a history entry`)
  }

  await beginMove()
  const zoom = editor.getState().zoom
  editor.getState().set({ zoom: zoom * 0.9, fit: false })
  await frame()
  check(!editor.getState().draft && sameDocument(), "zoom changes cancel the active gesture")
  editor.getState().set({ zoom, fit: true })
  await frame()

  await beginMove()
  studio.getState().commit("Verification setting change", (doc) => ({ ...doc, settings: { ...doc.settings, compactEmptyHours: false } }))
  await frame()
  check(!editor.getState().draft, "document setting changes cancel the active gesture")
  await undo()

  editor.getState().select(anchor.id)
  await frame()
  for (const [edge, minute, expected] of [["inicio", 572, 570], ["fin", 812, 810]]) {
    const handle = document.querySelector(`[aria-label="Cambiar hora de ${edge}"]`)
    pointerId++
    pointer(handle, "pointerdown", center(handle))
    await frame()
    const target = point("tue", minute)
    pointer(stage(), "pointermove", target)
    await frame()
    pointer(stage(), "pointerup", target)
    await frame()
    const block = studio.getState().session.doc.blocks.find((b) => b.id === anchor.id)
    check(edge === "inicio" ? block.start === expected && block.end === 720 : block.start === 600 && block.end === expected, `resize ${edge} changes only that edge`)
    await undo()
  }

  editor.getState().arm(anchor.subjectId)
  await frame()
  pointerId++
  pointer(stage(), "pointerdown", point("fri", 735))
  await frame()
  pointer(stage(), "pointermove", point("fri", 825))
  await frame()
  check(sameDocument(), "creating in empty hours does not expand the scale mid-gesture")
  pointer(stage(), "pointerup", point("fri", 825))
  await frame()
  const created = studio.getState().session.doc.blocks.at(-1)
  check(created.day === "fri" && created.start === 720 && created.end === 840, "creation snaps correctly inside compressed hours")
  check(scene().grid.timeScale.find((band) => band.start === 720).yEnd - scene().grid.timeScale.find((band) => band.start === 720).yStart > original.appearance.type.hour.size, "confirmed classes expand previously empty hours")
  await undo()

  pointerId++
  pointer(stage(), "pointerdown", point("fri", 735), "touch")
  await frame()
  pointer(stage(), "pointerup", point("fri", 735), "touch")
  await frame()
  check(editor.getState().candidate?.interval.start === 720 && sameDocument(), "touch placement creates a correctly timed confirmation candidate")
  editor.getState().set({ candidate: null, tool: "select", hover: null })
  await frame()
  check(await studio.getState().saveNow(), "project saves successfully")
  check(sameDocument(), "all browser checks restore the fixture")
  return { passed: results.length, results }
}
