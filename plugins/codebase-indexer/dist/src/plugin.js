import path from "node:path";
import { tool } from "@opencode-ai/plugin";
import { getConfigWarnings } from "./config.js";
import { managerFor, disposeManager } from "./runtime.js";
import { resolveWorkspace } from "./workspace.js";
import { sanitizeErrorMessage } from "./indexing/shared/validation-helpers.js";
const SYSTEM_GUIDANCE = [
    "Prefer semantic_search for conceptual code discovery.",
    "Follow semantic results with normal file reads or exact-text search before editing.",
    "Use index_status before diagnosing missing semantic results.",
    "Only call reindex_codebase after the user explicitly requests a rebuild.",
].join(" ");
export const CodebaseIndexerPlugin = async ({ worktree }) => {
    const root = await authorizedRoot(worktree).catch(() => undefined);
    if (root)
        void managerFor(root, true).catch(() => undefined);
    return {
        tool: createTools(worktree),
        "experimental.chat.system.transform": async (_input, output) => {
            output.system.push(SYSTEM_GUIDANCE);
        },
        dispose: async () => {
            if (root)
                disposeManager(root);
        },
    };
};
export default {
    id: "opencode-codebase-indexer",
    server: CodebaseIndexerPlugin,
};
export function createTools(pluginWorktree) {
    return {
        semantic_search: tool({
            description: "Semantically search the active indexed codebase.",
            args: {
                query: tool.schema.string().describe("Natural-language code search query."),
                path: tool.schema.string().optional().describe("Optional project-relative directory filter."),
                maxResults: tool.schema.number().int().min(1).max(100).optional(),
                minScore: tool.schema.number().min(0).max(1).optional(),
            },
            async execute(args, context) {
                return executeTool("semantic_search", args, context, pluginWorktree);
            },
        }),
        index_status: tool({
            description: "Return indexing status for the active project.",
            args: {},
            async execute(args, context) {
                return executeTool("index_status", args, context, pluginWorktree);
            },
        }),
        index_codebase: tool({
            description: "Start or resume indexing and watching for the active enrolled project.",
            args: {},
            async execute(args, context) {
                return executeTool("index_codebase", args, context, pluginWorktree);
            },
        }),
        reindex_codebase: tool({
            description: "Clear and fully rebuild the active project's index.",
            args: {
                confirm: tool.schema.boolean().describe("Must be true to confirm the destructive rebuild."),
            },
            async execute(args, context) {
                return executeTool("reindex_codebase", args, context, pluginWorktree);
            },
        }),
        stop_indexing: tool({
            description: "Stop indexing and file watching for the active project.",
            args: {},
            async execute(args, context) {
                return executeTool("stop_indexing", args, context, pluginWorktree);
            },
        }),
        index_doctor: tool({
            description: "Validate active-project enrollment and indexing configuration.",
            args: {},
            async execute(args, context) {
                return executeTool("index_doctor", args, context, pluginWorktree);
            },
        }),
    };
}
async function executeTool(name, args, context, pluginWorktree) {
    try {
        const root = await authorizedRoot(context.worktree, pluginWorktree);
        const manager = await managerFor(root, name !== "index_status" && name !== "index_doctor");
        let value;
        if (name === "semantic_search") {
            const prefix = args.path ? safePrefix(root, args.path) : undefined;
            const matches = await manager.searchIndex(args.query, prefix);
            value = matches
                .slice(0, args.maxResults ?? matches.length)
                .filter((match) => match.score >= (args.minScore ?? 0));
        }
        else if (name === "index_status") {
            value = safeStatus(manager.getCurrentStatus());
        }
        else if (name === "index_doctor") {
            value = { ...safeStatus(manager.getCurrentStatus()), configWarnings: await getConfigWarnings(root) };
        }
        else if (name === "index_codebase") {
            void manager.startIndexing().catch(() => undefined);
            value = safeStatus(manager.getCurrentStatus());
        }
        else if (name === "reindex_codebase") {
            if (args.confirm !== true)
                throw new Error("reindex_codebase requires confirm=true");
            await manager.clearIndexData();
            void manager.startIndexing().catch(() => undefined);
            value = safeStatus(manager.getCurrentStatus());
        }
        else if (name === "stop_indexing") {
            manager.cancelIndexing();
            value = safeStatus(manager.getCurrentStatus());
        }
        else {
            throw new Error(`Unknown tool: ${name}`);
        }
        return JSON.stringify(value, null, 2);
    }
    catch (error) {
        throw new Error(sanitizeErrorMessage(error instanceof Error ? error.message : String(error)));
    }
}
async function authorizedRoot(toolWorktree, pluginWorktree) {
    const roots = pluginWorktree ? [pluginWorktree] : [toolWorktree];
    return resolveWorkspace(toolWorktree, roots);
}
function safeStatus(status) {
    return {
        ...status,
        message: typeof status.message === "string" ? sanitizeErrorMessage(status.message) : status.message,
    };
}
function safePrefix(root, input) {
    const absolute = path.resolve(root, input);
    const relative = path.relative(root, absolute);
    if (!relative || relative === ".")
        return undefined;
    if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
        throw new Error(`path must be within the active project: ${input}`);
    }
    return path.normalize(relative);
}
//# sourceMappingURL=plugin.js.map