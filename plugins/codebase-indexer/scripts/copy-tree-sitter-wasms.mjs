import { copyFile, mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = path.join(pluginRoot, "dist", "tree-sitter")
const grammarDirectory = path.join(pluginRoot, "node_modules", "tree-sitter-wasms", "out")
const runtimeDirectory = path.join(pluginRoot, "node_modules", "web-tree-sitter")

const grammars = [
  "c",
  "cpp",
  "css",
  "c_sharp",
  "elisp",
  "elixir",
  "embedded_template",
  "go",
  "html",
  "java",
  "javascript",
  "kotlin",
  "lua",
  "ocaml",
  "php",
  "python",
  "ruby",
  "rust",
  "scala",
  "solidity",
  "swift",
  "systemrdl",
  "tlaplus",
  "toml",
  "tsx",
  "typescript",
  "vue",
  "zig",
]

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })
await copyFile(path.join(runtimeDirectory, "tree-sitter.wasm"), path.join(outputDirectory, "tree-sitter.wasm"))

for (const grammar of grammars) {
  const fileName = `tree-sitter-${grammar}.wasm`
  await copyFile(path.join(grammarDirectory, fileName), path.join(outputDirectory, fileName))
}

console.log(`Copied ${grammars.length + 1} Tree-sitter WASM files to ${outputDirectory}`)
