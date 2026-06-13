import { rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
await rm(path.join(pluginRoot, "dist"), { recursive: true, force: true })
