import os from "node:os"
import path from "node:path"
import { CodeIndexManager } from "./indexing/manager.js"
import { loadIndexConfig } from "./config.js"

const managers = new Map<string, CodeIndexManager>()

export async function managerFor(workspace: string, start = true): Promise<CodeIndexManager> {
  let manager = managers.get(workspace)
  if (!manager) {
    manager = new CodeIndexManager(workspace, path.join(os.homedir(), ".config", "opencode", "codebase-indexer", "cache"))
    managers.set(workspace, manager)
  }
  await manager.initialize(await loadIndexConfig(workspace))
  if (start && manager.isFeatureEnabled && manager.isFeatureConfigured && manager.state === "Standby") {
    void manager.startIndexing().catch(() => undefined)
  }
  return manager
}

export function disposeAll(): void {
  for (const manager of managers.values()) manager.dispose()
  managers.clear()
}

export function disposeManager(workspace: string): void {
  const manager = managers.get(workspace)
  if (!manager) return
  manager.dispose()
  managers.delete(workspace)
}
