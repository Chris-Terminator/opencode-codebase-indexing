/**
 * Runtime adapter interfaces for the indexing package.
 *
 * RATIONALE: Decouple the indexing engine from any host environment (VS Code, CLI, etc.)
 * by expressing all external capabilities as injectable contracts.
 */
/**
 * Minimal typed event emitter that replaces vscode.EventEmitter.
 * Consumers subscribe via `on()` and receive a dispose function.
 */
export class Emitter {
    listeners = new Set();
    on(listener) {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }
    fire(value) {
        for (const listener of this.listeners) {
            listener(value);
        }
    }
    dispose() {
        this.listeners.clear();
    }
}
//# sourceMappingURL=runtime.js.map