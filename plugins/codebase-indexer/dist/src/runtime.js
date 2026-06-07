import os from "node:os";
import path from "node:path";
import { CodeIndexManager } from "./indexing/manager.js";
import { loadIndexConfig } from "./config.js";
const managers = new Map();
export async function managerFor(workspace, start = true) {
    let manager = managers.get(workspace);
    if (!manager) {
        manager = new CodeIndexManager(workspace, path.join(os.homedir(), ".codex", "codebase-indexer", "cache"));
        managers.set(workspace, manager);
    }
    await manager.initialize(await loadIndexConfig(workspace));
    if (start && manager.isFeatureEnabled && manager.isFeatureConfigured && manager.state === "Standby") {
        void manager.startIndexing();
    }
    return manager;
}
export function disposeAll() {
    for (const manager of managers.values())
        manager.dispose();
    managers.clear();
}
//# sourceMappingURL=runtime.js.map