import { describe, expect, test } from "bun:test"
import { createDocument } from "../src/domain/document"
import { projectFile, readImport } from "../src/domain/files"
import { migrateLegacy } from "../src/domain/legacy"
import { validateDocument } from "../src/domain/schema"

describe("compression setting compatibility", () => {
  test("new projects and existing v2 documents default to uniform", () => {
    expect(createDocument().settings.compactEmptyHours).toBe(false)
    const old = JSON.parse(JSON.stringify(createDocument()))
    delete old.settings.compactEmptyHours
    const result = validateDocument(old)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.document.settings.compactEmptyHours).toBe(false)
  })

  test("project and backup JSON retain the option", () => {
    const doc = createDocument({ compactEmptyHours: true })
    for (const file of [projectFile(doc), { format: "horario-studio/backup", schemaVersion: 2, projects: [{ document: doc }], themes: [], swatches: [] }]) {
      const result = readImport(JSON.stringify(file))
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      if (result.candidate.kind === "project") expect(result.candidate.document.settings.compactEmptyHours).toBe(true)
      if (result.candidate.kind === "backup") expect(result.candidate.projects[0]!.document.settings.compactEmptyHours).toBe(true)
    }
  })

  test("rejects malformed values rather than silently enabling compression", () => {
    for (const value of ["true", 1, null]) {
      const doc = createDocument()
      expect(validateDocument({ ...doc, settings: { ...doc.settings, compactEmptyHours: value } }).ok).toBe(false)
    }
  })

  test("v1 imports preserve the explicit optimized or uniform choice", () => {
    for (const mode of ["optimizado", "uniforme", undefined]) {
      const result = migrateLegacy({ version: 1, settings: { compactMode: mode }, items: [] })
      expect("document" in result).toBe(true)
      if ("document" in result) expect(result.document.settings.compactEmptyHours).toBe(mode === "optimizado")
    }
  })
})
