import util from "util";
import { exec as rawExec } from "child_process";
import os from "os";
const exec = util.promisify(rawExec);

const essentialWindowsEnvVars = [
    "COMSPEC",
    "SystemDrive",
    "SystemRoot",
    "TEMP",
    "TMP",
    "PATH", // Or 'Path', check process.env casing
    "PATHEXT",
    "USERNAME",
    "USERPROFILE",
    "PROMPT",
    "ALLUSERSPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "ProgramFiles",
    "ProgramFiles(x86)",
    "ProgramW6432",
    "OS",
    "PROCESSOR_ARCHITECTURE",
    "PROCESSOR_IDENTIFIER",
    "PROCESSOR_LEVEL",
    "PROCESSOR_REVISION",
    "NUMBER_OF_PROCESSORS",
];
const essentialLinuxEnvVars = [
    "PATH",
    "HOME",
    "LANG",
    "USER",
    "SHELL",
    "TERM",
    "TMPDIR",
    "PWD",
    "LOGNAME",
];

function getEssentialEnvVars() {
    const platform = os.platform();
    if (platform === "win32") {
        return essentialWindowsEnvVars;
    } else {
        return essentialLinuxEnvVars;
    }
}
function getCleanEnv(extra = {}) {
    const keys = getEssentialEnvVars();
    const cleanEnv = {};
    for (const key of keys) {
        if (process.env[key] !== undefined) {
            cleanEnv[key] = process.env[key];
        }
    }
    return { ...cleanEnv, ...extra };
}

export async function runCommand(cmd, cwd = undefined, extraEnv = {}) {
    try {
        // Build a clean env object: start from empty or process.env, then override
        const env = getCleanEnv(extraEnv);
        const { stdout, stderr } = await exec(cmd, {
            cwd,
            env,
        });
        return { stdout, stderr };
    } catch (err) {
        return {
            error: true,
            code: err.code,
            stdout: err.stdout,
            stderr: err.stderr,
            message: err.message,
        };
    }
}

export class CommandRunner {
    constructor(cwd) {
        this.cwd = cwd;
    }

    async run(cmd) {
        return runCommand(cmd, this.cwd);
    }
}
