import path from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

await build({
  entryPoints: [path.join(pluginRoot, "src", "plugin.ts")],
  outfile: path.join(pluginRoot, "dist", "plugin.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      'import { fileURLToPath as __fileURLToPath } from "node:url";',
      'import { dirname as __pathDirname } from "node:path";',
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __pathDirname(__filename);",
    ].join("\n"),
  },
})
