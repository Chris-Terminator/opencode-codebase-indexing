import readline from "node:readline";
import path from "node:path";
import { managerFor, disposeAll } from "./runtime.js";
import { resolveWorkspace, uriToPath } from "./workspace.js";
const pending = new Map();
let requestId = 0;
let roots = [];
function send(message) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
}
function result(id, value) {
    send({ jsonrpc: "2.0", id, result: value });
}
function error(id, message) {
    send({ jsonrpc: "2.0", id, error: { code: -32602, message } });
}
async function request(method, params) {
    const id = `server-${++requestId}`;
    send({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve) => pending.set(id, resolve));
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
];
function tool(name, description, properties, required = []) {
    return { name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } };
}
function stringProp(description) {
    return { type: "string", description };
}
async function workspace(args) {
    return resolveWorkspace(args.workspacePath, roots);
}
async function call(name, args) {
    const root = await workspace(args);
    const manager = await managerFor(root, name !== "index_status" && name !== "index_doctor");
    if (name === "semantic_search") {
        const prefix = args.path ? path.normalize(args.path) : undefined;
        const matches = await manager.searchIndex(args.query, prefix);
        return matches.slice(0, args.maxResults ?? matches.length).filter((match) => match.score >= (args.minScore ?? 0));
    }
    if (name === "index_status" || name === "index_doctor")
        return manager.getCurrentStatus();
    if (name === "index_codebase") {
        void manager.startIndexing();
        return manager.getCurrentStatus();
    }
    if (name === "reindex_codebase") {
        if (args.confirm !== true)
            throw new Error("reindex_codebase requires confirm=true");
        await manager.clearIndexData();
        void manager.startIndexing();
        return manager.getCurrentStatus();
    }
    if (name === "stop_indexing") {
        manager.cancelIndexing();
        return manager.getCurrentStatus();
    }
    throw new Error(`Unknown tool: ${name}`);
}
async function handle(message) {
    if (message.method === "initialize") {
        result(message.id, {
            protocolVersion: message.params?.protocolVersion ?? "2025-11-25",
            capabilities: { tools: {} },
            serverInfo: { name: "codebase-indexer", version: "0.1.0" },
            instructions: "Prefer semantic_search for conceptual code discovery. Always pass the active workspacePath when MCP roots are unavailable.",
        });
        void request("roots/list").then((value) => {
            roots = (value?.roots ?? []).map((root) => uriToPath(root.uri)).filter(Boolean);
        }).catch(() => undefined);
        return;
    }
    if (message.method === "tools/list")
        return result(message.id, { tools });
    if (message.method === "ping")
        return result(message.id, {});
    if (message.method === "notifications/roots/list_changed") {
        const value = await request("roots/list");
        roots = (value?.roots ?? []).map((root) => uriToPath(root.uri)).filter(Boolean);
        return;
    }
    if (message.method === "tools/call") {
        try {
            const value = await call(message.params?.name, message.params?.arguments ?? {});
            return result(message.id, { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: { result: value } });
        }
        catch (err) {
            return error(message.id, err instanceof Error ? err.message : String(err));
        }
    }
    if (message.id !== undefined)
        error(message.id, `Method not found: ${message.method}`);
}
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
    if (!line.trim())
        return;
    const message = JSON.parse(line);
    if (!message.method && message.id !== undefined) {
        const resolve = pending.get(String(message.id));
        if (resolve) {
            pending.delete(String(message.id));
            resolve(message.result);
        }
        return;
    }
    void handle(message);
});
process.on("exit", disposeAll);
//# sourceMappingURL=mcp-server.js.map