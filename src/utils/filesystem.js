import { access, stat, rm } from "fs/promises";
import { constants } from "fs";

export const fileExists = async (path) => {
    try {
        await access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
};
export const folderExists = async (path) => {
    try {
        const stats = await stat(path);
        return stats.isDirectory();
    } catch {
        return false;
    }
};
export const validateWritable = async (path) => {
    try {
        await access(path, constants.F_OK | constants.W_OK);
        return true;
    } catch {
        return false;
    }
};
export async function safeDeleteFolder(path) {
    try {
        await rm(path, { recursive: true, force: true });
    } catch {
        // silently ignore errors
    }
}
