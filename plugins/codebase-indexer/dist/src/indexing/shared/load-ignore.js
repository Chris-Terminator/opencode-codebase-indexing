import fs from "fs/promises";
import ignore from "ignore";
import path from "path";
const files = [".gitignore", ".kilocodeignore"];
function notFound(err) {
    if (!err || typeof err !== "object") {
        return false;
    }
    return "code" in err && err.code === "ENOENT";
}
async function read(root, name) {
    return fs.readFile(path.join(root, name), "utf8").catch((err) => {
        if (notFound(err)) {
            return undefined;
        }
        throw err;
    });
}
export async function loadIgnore(root) {
    const ig = ignore();
    for (const name of files) {
        const txt = await read(root, name);
        if (!txt?.trim()) {
            continue;
        }
        ig.add(txt);
        ig.add(name);
    }
    return ig;
}
//# sourceMappingURL=load-ignore.js.map