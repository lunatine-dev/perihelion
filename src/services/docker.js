import { CommandRunner } from "#utils/cli";

const runner = new CommandRunner();

const parseStatus = (statusStr) => {
    const lower = statusStr.toLowerCase();
    if (lower.startsWith("up")) return { status: "online", details: statusStr };
    if (lower.startsWith("exited"))
        return { status: "offline", details: statusStr };
    if (lower.startsWith("restarting"))
        return { status: "restarting", details: statusStr };
    if (lower.includes("paused"))
        return { status: "paused", details: statusStr };
    return { status: "unknown", details: statusStr };
};

const extractPorts = (portsStr) => {
    if (!portsStr) return [];
    return portsStr
        .split(",")
        .map((p) => p.trim())
        .map((p) => {
            const match = p.match(/:(\d+)->/);
            return match ? Number(match[1]) : null;
        })
        .filter(Boolean);
};

export const getDockerContainers = async () => {
    const psResult = await runner.run(
        'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}"',
    );

    if (psResult.error) {
        console.error(
            "Error running docker ps:",
            psResult.message,
            psResult.stderr,
        );
        return [];
    }

    if (!psResult.stdout) return [];

    return psResult.stdout
        .trim()
        .split("\n")
        .map((line) => {
            const [id, name, rawStatus, ports] = line.split("|");
            const { status, details } = parseStatus(rawStatus);
            return { id, name, status, details, ports: extractPorts(ports) };
        });
};

export const getDockerContainer = async (repoId) => {
    if (!repoId) return null;

    const psResult = await runner.run(
        `docker ps -a --filter "label=repo_id=${repoId}" --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}"`,
    );

    if (psResult.error) {
        console.error(
            `Error fetching container for repo ${repoId}:`,
            psResult.message,
            psResult.stderr,
        );
        return null;
    }

    if (!psResult.stdout) return null;

    const line = psResult.stdout.trim().split("\n")[0];
    if (!line) return null;

    const [id, name, rawStatus, ports] = line.split("|");
    const { status, details } = parseStatus(rawStatus);
    return { id, name, status, details, ports: extractPorts(ports) };
};
