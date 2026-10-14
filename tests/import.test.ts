import { expect, test } from "bun:test"
import { createDocument } from "../src/domain/document"
import { readImport } from "../src/domain/files"

test("v2 backups are dispatched by format before raw v2 documents", () => {
  const result = readImport(JSON.stringify({
    format: "horario-studio/backup", schemaVersion: 2,
    projects: [{ document: createDocument() }], themes: [], swatches: [],
  }))
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.candidate.kind).toBe("backup")
    if (result.candidate.kind === "backup") expect(result.candidate.projects).toHaveLength(1)
  }
})
