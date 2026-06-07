import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isProjectEnrolled } from "./config.js"

export async function resolveWorkspace(explicit?: unknown, roots: string[] = []): Promise<string> {
  const normalizedRoots = await Promise.all(roots.map(canonicalPath))
  const requested = typeof explicit === "string" ? await canonicalPath(explicit) : normalizedRoots[0]
  if (!requested) {
    throw new Error("No project root is available. Pass workspacePath explicitly from the active Codex workspace.")
  }

  if (normalizedRoots.length > 0 && !normalizedRoots.some((root) => samePath(root, requested))) {
    throw new Error("workspacePath must exactly match an active Codex workspace root.")
  }

  const stat = await fs.stat(requested).catch(() => undefined)
  if (!stat?.isDirectory()) throw new Error(`Workspace does not exist or is not a directory: ${requested}`)
  if (!(await isProjectEnrolled(requested))) {
    throw new Error("Workspace is not enrolled. Add .codex/codebase-indexer.json with { \"enabled\": true }.")
  }
  if (await isLinkedWorktree(requested)) {
    throw new Error("Indexing is disabled in Git linked worktrees. Open the main checkout instead.")
  }
  return requested
}

export function uriToPath(uri: string): string | undefined {
  try {
    return uri.startsWith("file:") ? fileURLToPath(uri) : undefined
  } catch {
    return undefined
  }
}

async function isLinkedWorktree(workspace: string): Promise<boolean> {
  try {
    const git = await fs.stat(path.join(workspace, ".git"))
    return git.isFile()
  } catch {
    return false
  }
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right
}

async function canonicalPath(input: string): Promise<string> {
  const resolved = path.resolve(input)
  return fs.realpath(resolved).catch(() => resolved)
}
