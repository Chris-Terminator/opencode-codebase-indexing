import { Emitter } from "./runtime";
export class CodeIndexStateManager {
    _systemStatus = "Standby";
    _statusMessage = "";
    _processedFiles = 0;
    _totalFiles = 0;
    _percent = 0;
    _gitBranch;
    _manifest;
    _progressEmitter = new Emitter();
    onProgressUpdate = this._progressEmitter;
    get state() {
        return this._systemStatus;
    }
    getCurrentStatus() {
        return {
            systemStatus: this._systemStatus,
            message: this._statusMessage,
            processedItems: this._processedFiles,
            totalItems: this._totalFiles,
            currentItemUnit: "files",
            percent: this._percent,
            gitBranch: this._gitBranch,
            manifest: this._manifest,
        };
    }
    setSystemState(newState, message, manifest, gitBranch) {
        const stateChanged = newState !== this._systemStatus || (message !== undefined && message !== this._statusMessage);
        if (!stateChanged)
            return;
        this._systemStatus = newState;
        if (message !== undefined)
            this._statusMessage = message;
        if (manifest !== undefined)
            this._manifest = manifest;
        if (gitBranch !== undefined)
            this._gitBranch = gitBranch;
        if (newState !== "Indexing") {
            this._percent = newState === "Indexed" ? 100 : 0;
            if (newState === "Standby" && message === undefined)
                this._statusMessage = "Ready.";
            if (newState === "Indexed" && message === undefined)
                this._statusMessage = "Index up-to-date.";
            if (newState === "Error" && message === undefined)
                this._statusMessage = "An error occurred.";
        }
        if (newState !== "Indexed") {
            this._manifest = undefined;
        }
        this._progressEmitter.fire(this.getCurrentStatus());
    }
    reportFileProgress(processedFiles, totalFiles, currentFileBasename) {
        const percent = totalFiles > 0 ? Math.min(100, Math.round((processedFiles / totalFiles) * 100)) : 0;
        const progressChanged = processedFiles !== this._processedFiles || totalFiles !== this._totalFiles || percent !== this._percent;
        if (!progressChanged && this._systemStatus === "Indexing")
            return;
        this._processedFiles = processedFiles;
        this._totalFiles = totalFiles;
        this._percent = percent;
        const message = totalFiles > 0
            ? `Indexed ${processedFiles} / ${totalFiles} files (${percent}%).${currentFileBasename ? ` Current: ${currentFileBasename}` : ""}`
            : "Indexing files...";
        const oldStatus = this._systemStatus;
        const oldMessage = this._statusMessage;
        this._systemStatus = "Indexing";
        this._statusMessage = message;
        if (oldStatus !== this._systemStatus || oldMessage !== this._statusMessage || progressChanged) {
            this._progressEmitter.fire(this.getCurrentStatus());
        }
    }
    reportFileQueueProgress(processedFiles, totalFiles, currentFileBasename) {
        this.reportFileProgress(processedFiles, totalFiles, currentFileBasename);
    }
    dispose() {
        this._progressEmitter.dispose();
    }
}
//# sourceMappingURL=state-manager.js.map