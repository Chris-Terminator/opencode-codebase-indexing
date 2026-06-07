const enabled = process.env.KILO_INDEXING_LOG === "1" || process.env.KILO_INDEXING_LOG === "true";
export var Log;
(function (Log) {
    function create(input = {}) {
        const tags = { ...input };
        function write(level, message, extra) {
            if (!enabled)
                return;
            const line = JSON.stringify({
                level,
                time: new Date().toISOString(),
                message,
                ...tags,
                ...extra,
            });
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