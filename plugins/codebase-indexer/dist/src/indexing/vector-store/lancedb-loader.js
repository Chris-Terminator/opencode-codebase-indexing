const env = "KILO_LANCEDB_PATH";
export function resolveLanceDBSpecifier() {
    return process.env[env] || "@lancedb/lancedb";
}
export async function loadLanceDB() {
    return import(resolveLanceDBSpecifier());
}
//# sourceMappingURL=lancedb-loader.js.map