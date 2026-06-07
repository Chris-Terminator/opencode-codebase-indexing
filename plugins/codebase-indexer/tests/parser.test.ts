import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { codeParser } from "../src/indexing/processors/parser.js"
import {
  loadRequiredLanguageParsers,
  resolveCoreRuntimeWasmPath,
  resolveLanguageWasmPath,
} from "../src/tree-sitter/languageParser.js"

test("Tree-sitter extracts semantic TypeScript blocks", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-indexer-parser-"))
  const file = path.join(dir, "auth.ts")
  const content = `
export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || password.length < 12) throw new Error("invalid credentials")
  return { normalizedEmail, authenticated: true }
}
`.trim()
  await fs.writeFile(file, content)
  const blocks = await codeParser.parseFile(file)
  assert.ok(blocks.some((block) => block.content.includes("authenticateUser")))
  assert.ok(blocks.every((block) => block.start_line >= 1 && block.end_line >= block.start_line))
})

test("packaged Tree-sitter assets load without dependency WASM resolution", async () => {
  const packagedDirectory = path.resolve("dist", "tree-sitter")
  assert.equal(resolveCoreRuntimeWasmPath(packagedDirectory), path.join(packagedDirectory, "tree-sitter.wasm"))
  assert.equal(
    resolveLanguageWasmPath("typescript", packagedDirectory).wasmPath,
    path.join(packagedDirectory, "tree-sitter-typescript.wasm"),
  )

  const parsers = await loadRequiredLanguageParsers(["packaged-install-test.ts"], packagedDirectory)
  const tree = parsers.ts.parser.parse("export function packagedParserWorks() { return true }")
  assert.ok(tree?.rootNode.text.includes("packagedParserWorks"))
})
