import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export async function resolveWorkspace(explicit, roots = []) {
    const candidates = [typeof explicit === "string" ? explicit : undefined, ...roots].filter(Boolean);
    if (candidates.length === 0) {
        throw new Error("No project root is available. Pass workspacePath explicitly from the active Codex workspace.");
    }
    const resolved = path.resolve(candidates[0]);
    const stat = await fs.stat(resolved).catch(() => undefined);
    if (!stat?.isDirectory())
        throw new Error(`Workspace does not exist or is not a directory: ${resolved}`);
    if (await isLinkedWorktree(resolved)) {
        throw new Error("Indexing is disabled in Git linked worktrees. Open the main checkout instead.");
    }
    return resolved;
}
export function uriToPath(uri) {
    try {
        return uri.startsWith("file:") ? fileURLToPath(uri) : undefined;
    }
    catch {
        return undefined;
    }
}
async function isLinkedWorktree(workspace) {
    try {
        const git = await fs.stat(path.join(workspace, ".git"));
        return git.isFile();
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=workspace.js.map