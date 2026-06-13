type Entry = {
  debug(message?: unknown, extra?: Record<string, unknown>): void
  info(message?: unknown, extra?: Record<string, unknown>): void
  warn(message?: unknown, extra?: Record<string, unknown>): void
  error(message?: unknown, extra?: Record<string, unknown>): void
  tag(key: string, value: string): Entry
  clone(): Entry
  time(
    message: string,
    extra?: Record<string, unknown>,
  ): {
    stop(): void
    [Symbol.dispose](): void
  }
}

const enabled =
  process.env.OPENCODE_CODEBASE_INDEXER_LOG === "1" || process.env.OPENCODE_CODEBASE_INDEXER_LOG === "true"
const sensitiveKey = /api[-_]?key|authorization|credential|password|secret|token/i

function redact(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]"
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) }
  if (typeof value === "string") return redactText(value)
  if (Array.isArray(value)) return value.map((item) => redact(item))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redact(child, childKey)]))
  }
  return value
}

export function redactLogValue(value: unknown): unknown {
  return redact(value)
}

function redactText(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+\b/gi, "Bearer [REDACTED]")
}

export namespace Log {
  export type Logger = Entry

  export function create(input: Record<string, unknown> = {}): Entry {
    const tags = { ...input }

    function write(level: string, message?: unknown, extra?: Record<string, unknown>) {
      if (!enabled) return

      const line = JSON.stringify(redact({
        level,
        time: new Date().toISOString(),
        message,
        ...tags,
        ...extra,
      }))
      console.error(line)
    }

    const log: Entry = {
      debug(message, extra) {
        write("DEBUG", message, extra)
      },
      info(message, extra) {
        write("INFO", message, extra)
      },
      warn(message, extra) {
        write("WARN", message, extra)
      },
      error(message, extra) {
        write("ERROR", message, extra)
      },
      tag(key, value) {
        tags[key] = value
        return log
      },
      clone() {
        return create(tags)
      },
      time(message, extra) {
        const start = Date.now()
        const stop = () => {
          write("INFO", message, { duration: Date.now() - start, ...extra })
        }
        return {
          stop,
          [Symbol.dispose]() {
            stop()
          },
        }
      },
    }

    return log
  }
}
