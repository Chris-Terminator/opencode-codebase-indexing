import fs from "node:fs/promises";
import path from "node:path";
export async function isRealPathWithinWorkspace(filePath, workspacePath) {
    try {
        const [realFile, realWorkspace] = await Promise.all([fs.realpath(filePath), fs.realpath(workspacePath)]);
        const relative = path.relative(realWorkspace, realFile);
        return relative !== "" && !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=path-security.js.map