const enabled = process.env.OPENCODE_CODEBASE_INDEXER_LOG === "1" || process.env.OPENCODE_CODEBASE_INDEXER_LOG === "true";
const sensitiveKey = /api[-_]?key|authorization|credential|password|secret|token/i;
function redact(value, key = "") {
    if (sensitiveKey.test(key))
        return "[REDACTED]";
    if (value instanceof Error)
        return { name: value.name, message: redactText(value.message) };
    if (typeof value === "string")
        return redactText(value);
    if (Array.isArray(value))
        return value.map((item) => redact(item));
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redact(child, childKey)]));
    }
    return value;
}
export function redactLogValue(value) {
    return redact(value);
}
function redactText(value) {
    return value
        .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_API_KEY]")
        .replace(/\bBearer\s+[A-Za-z0-9._~-]+\b/gi, "Bearer [REDACTED]");
}
export var Log;
(function (Log) {
    function create(input = {}) {
        const tags = { ...input };
        function write(level, message, extra) {
            if (!enabled)
                return;
            const line = JSON.stringify(redact({
                level,
                time: new Date().toISOString(),
                message,
                ...tags,
                ...extra,
            }));
            console.error(line);
        }
        const log = {
            debug(message, extra) {
                write("DEBUG", message, extra);
            },
            info(message, extra) {
                write("INFO", message, extra);
            },
            warn(message, extra) {
                write("WARN", message, extra);
            },
            error(message, extra) {
                write("ERROR", message, extra);
            },
            tag(key, value) {
                tags[key] = value;
                return log;
            },
            clone() {
                return create(tags);
            },
            time(message, extra) {
                const start = Date.now();
                const stop = () => {
                    write("INFO", message, { duration: Date.now() - start, ...extra });
                };
                return {
                    stop,
                    [Symbol.dispose]() {
                        stop();
                    },
                };
            },
        };
        return log;
    }
    Log.create = create;
})(Log || (Log = {}));
//# sourceMappingURL=log.js.map