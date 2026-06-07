import readline from "node:readline"
import path from "node:path"
import { managerFor, disposeAll, retainManagers } from "./runtime.js"
import { resolveWorkspace, uriToPath } from "./workspace.js"
import { getConfigWarnings, isProjectEnrolled } from "./config.js"
import { sanitizeErrorMessage } from "./indexing/shared/validation-helpers.js"

const pending = new Map<string, (value: any) => void>()
let requestId = 0
let roots: string[] = []

function send(message: unknown) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function result(id: unknown, value: unknown) {
  send({ jsonrpc: "2.0", id, result: value })
}

function error(id: unknown, message: string) {
  send({ jsonrpc: "2.0", id, error: { code: -32602, message: sanitizeErrorMessage(message) } })
}

async function request(method: string, params?: unknown): Promise<any> {
  const id = `server-${++requestId}`
  send({ jsonrpc: "2.0", id, method, params })
  return new Promise((resolve) => pending.set(id, resolve))
}

const tools = [
  tool("semantic_search", "Semantically search the active indexed codebase.", {
    query: stringProp("Natural-language code search query."),
    workspacePath: stringProp("Absolute project root fallback."),
    path: stringProp("Optional project-relative directory filter."),
    maxResults: { type: "number", minimum: 1, maximum: 100 },
    minScore: { type: "number", minimum: 0, maximum: 1 },
  }, ["query"]),
  tool("index_status", "Return indexing status for the active project.", { workspacePath: stringProp("Absolute project root fallback.") }),
  tool("index_codebase", "Start or resume indexing and watching for an enrolled project.", { workspacePath: stringProp("Absolute project root fallback.") }),
  tool("reindex_codebase", "Clear and fully rebuild one project's index.", {
    workspacePath: stringProp("Absolute project root fallback."),
    confirm: { type: "boolean" },
  }, ["confirm"]),
  tool("stop_indexing", "Stop indexing and file watching for one project.", { workspacePath: stringProp("Absolute project root fallback.") }),
  tool("index_doctor", "Validate project enrollment and indexing configuration.", { workspacePath: stringProp("Absolute project root fallback.") }),
]

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []) {
  return { name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } }
}

function stringProp(description: string) {
  return { type: "string", description }
}

async function workspace(args: Record<string, any>) {
  return resolveWorkspace(args.workspacePath, roots)
}

async function refreshRoots(value: any) {
  const reported = (value?.roots ?? []).map((root: any) => uriToPath(root.uri)).filter(Boolean)
  const authorized: string[] = []
  for (const root of reported) {
    try {
      authorized.push(await resolveWorkspace(root, reported))
    } catch {
      // Invalid, unenrolled, or linked-worktree roots are not authorized.
    }
  }
  roots = authorized
  retainManagers(roots)
  for (const root of roots) {
    if (await isProjectEnrolled(root)) void managerFor(root, true).catch(() => undefined)
  }
}

async function call(name: string, args: Record<string, any>) {
  const root = await workspace(args)
  const manager = await managerFor(root, name !== "index_status" && name !== "index_doctor")

  if (name === "semantic_search") {
    const prefix = args.path ? safePrefix(root, args.path) : undefined
    const matches = await manager.searchIndex(args.query, prefix)
    return matches.slice(0, args.maxResults ?? matches.length).filter((match) => match.score >= (args.minScore ?? 0))
  }
  if (name === "index_status") return safeStatus(manager.getCurrentStatus())
  if (name === "index_doctor") {
    return { ...safeStatus(manager.getCurrentStatus()), configWarnings: await getConfigWarnings(root) }
  }
  if (name === "index_codebase") {
    void manager.startIndexing().catch(() => undefined)
    return safeStatus(manager.getCurrentStatus())
  }
  if (name === "reindex_codebase") {
    if (args.confirm !== true) throw new Error("reindex_codebase requires confirm=true")
    await manager.clearIndexData()
    void manager.startIndexing().catch(() => undefined)
    return safeStatus(manager.getCurrentStatus())
  }
  if (name === "stop_indexing") {
    manager.cancelIndexing()
    return safeStatus(manager.getCurrentStatus())
  }
  throw new Error(`Unknown tool: ${name}`)
}

function safeStatus<T extends { message?: unknown }>(status: T): T {
  return {
    ...status,
    message: typeof status.message === "string" ? sanitizeErrorMessage(status.message) : status.message,
  }
}

function safePrefix(root: string, input: string): string | undefined {
  const absolute = path.resolve(root, input)
  const relative = path.relative(root, absolute)
  if (!relative || relative === ".") return undefined
  if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`path must be within the active project: ${input}`)
  }
  return path.normalize(relative)
}

async function handle(message: any) {
  if (message.method === "initialize") {
    result(message.id, {
      protocolVersion: message.params?.protocolVersion ?? "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: { name: "codebase-indexer", version: "0.1.0" },
      instructions: "Prefer semantic_search for conceptual code discovery. Always pass the active workspacePath when MCP roots are unavailable.",
    })
    void request("roots/list").then(refreshRoots).catch(() => undefined)
    return
  }
  if (message.method === "tools/list") return result(message.id, { tools })
  if (message.method === "ping") return result(message.id, {})
  if (message.method === "notifications/roots/list_changed") {
    await refreshRoots(await request("roots/list"))
    return
  }
  if (message.method === "tools/call") {
    try {
      const value = await call(message.params?.name, message.params?.arguments ?? {})
      return result(message.id, { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: { result: value } })
    } catch (err) {
      return error(message.id, err instanceof Error ? err.message : String(err))
    }
  }
  if (message.id !== undefined) error(message.id, `Method not found: ${message.method}`)
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
lines.on("line", (line) => {
  if (!line.trim()) return
  let message: any
  try {
    message = JSON.parse(line)
  } catch {
    return error(null, "Invalid JSON-RPC message.")
  }
  if (!message.method && message.id !== undefined) {
    const resolve = pending.get(String(message.id))
    if (resolve) {
      pending.delete(String(message.id))
      resolve(message.result)
    }
    return
  }
  void handle(message).catch((err) => {
    if (message.id !== undefined) error(message.id, err instanceof Error ? err.message : String(err))
  })
})
process.on("exit", disposeAll)
