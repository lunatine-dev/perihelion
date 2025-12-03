import { octokit } from "#services/github";
import { handleAsync } from "#utils/awaitHandler";
import fs from "fs/promises";
import path from "path";
import {
    fileExists,
    folderExists,
    safeDeleteFolder,
    validateWritable,
} from "#utils/filesystem";
import { CommandRunner } from "#utils/cli";

const __dirname = import.meta.dirname;

const hasGitFolder = async (repoPath) => {
    const gitPath = path.join(repoPath, ".git");

    return await folderExists(gitPath);
};
const isDockerApp = async (repoPath) => {
    const dockerFiles = [
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
    ];

    for (const file of dockerFiles) {
        if (await fileExists(path.join(repoPath, file))) {
            return true;
        }
    }

    return false;
};

const generateShortId = () => {
    // base36 timestamp + 4 chars random base36
    return (
        Date.now().toString(36) + // base36 timestamp
        Math.random().toString(36).slice(2, 8) // 6 random chars
    );
};

class Job {
    constructor(type) {
        this.id = generateShortId();
        this.type = type;
        this.status = { tag: "queued", text: "Waiting to start" };
        this.history = [];
        this.logStatus("queued", "Waiting to start");
        this.createdAt = Date.now();
    }

    logStatus(tag, text) {
        this.status = { tag, text };
        this.history.push({ tag, text, timestamp: Date.now() });
    }

    async run() {
        throw new Error("run() must be implemented in subclass");
    }

    async validateRepo() {
        const [repoData, repoErr] = await handleAsync(
            octokit.request("GET /repos/{owner}/{repo}", {
                owner: this.owner,
                repo: this.repo,
            }),
        );

        if (repoErr) {
            console.error("Repo validation failed", repoErr);
            return false;
        }

        return repoData?.data?.id?.toString();
    }
}

export class CloneJob extends Job {
    constructor(owner, repo, env = "") {
        super("clone");
        this.owner = owner;
        this.repo = repo;
        this.env = env;
    }

    async run() {
        this.logStatus("processing", "Validating repository");
        const repoId = await this.validateRepo();

        if (!repoId) {
            throw new Error("Failed to find a valid repository");
        }

        // Validate that we can actually clone into the given directory and that it exists
        const cloneDirectory = process.env.REPO_CLONE_DIR;

        if (!cloneDirectory) {
            throw new Error("REPO_CLONE_DIR is not defined");
        }

        if (!(await folderExists(cloneDirectory))) {
            throw new Error("Clone directory does not exist");
        }

        if (!(await validateWritable(cloneDirectory))) {
            throw new Error("Clone directory is not writable");
        }

        // We know we can write here, let's check if the repository already exists so we know if we should clone or pull the repository!
        // Local repos look like /{clone_dir}/{id}
        const localRepoPath = path.join(cloneDirectory, repoId);
        const repoExists = await folderExists(localRepoPath);
        const gitExists = repoExists && (await hasGitFolder(localRepoPath));

        const baseRunner = new CommandRunner(cloneDirectory);
        const repoRunner = new CommandRunner(localRepoPath);

        if (!gitExists) {
            if (repoExists) {
                await safeDeleteFolder(localRepoPath); //not a valid repo, delete so we can clone.
            }
            // we can clone
            this.logStatus("processing", "Cloning repository");
            const cloneUrl = `https://oauth2:${process.env.GITHUB_PAT_TOKEN}@github.com/${this.owner}/${this.repo}.git`;
            const clone = await baseRunner.run(
                `git clone ${cloneUrl} ${repoId}`,
            );

            if (clone.error) {
                throw new Error("Failed to clone repo");
            }
        } else {
            // we can pull
            this.logStatus("processing", "Pulling repository");
            const stash = await repoRunner.run("git stash");
            if (
                stash.error &&
                !stash.stderr?.includes("No local changes to save")
            ) {
                throw new Error(`Failed to stash changes`);
            }
            const pull = await repoRunner.run("git pull");
            if (pull.error) {
                throw new Error("Failed to pull changes");
            }
        }

        //check for existence of a DOCKERFILE or docker compose
        if (!(await isDockerApp(localRepoPath))) {
            await safeDeleteFolder(localRepoPath);
            throw new Error("Not a docker app");
        }

        console.log(`Writing .env file with ${this?.env?.length} length`);

        // from here, we've either successfully cloned or pulled a repo, either way we have a repo in our local folders. Now we can copy the environment variables handed to us
        await fs
            .writeFile(path.join(localRepoPath, ".env"), this.env, {
                encoding: "utf8",
            })
            .catch(console.error);

        // Job complete, now it's up to the app to read the job completion event and add the docker job.
    }
}

export class DockerJob extends Job {
    constructor(owner, repo) {
        super("docker");
        this.owner = owner;
        this.repo = repo;
    }

    async run() {
        this.logStatus("processing", "Validating repository");

        const repoId = await this.validateRepo();

        if (!repoId) {
            throw new Error("Failed to find a valid repository");
        }

        // Obviously we need to do checks about the local repository even existing. Despite this job usually being called AFTER the repo logic, it's probably best to validate again for edge cases
        const cloneDirectory = process.env.REPO_CLONE_DIR;
        if (!cloneDirectory) {
            throw new Error("REPO_CLONE_DIR is not defined");
        }
        if (!(await folderExists(cloneDirectory))) {
            throw new Error("Clone directory does not exist");
        }

        const localRepoPath = path.join(cloneDirectory, repoId);
        const repoExists = await folderExists(localRepoPath);

        if (!repoExists) {
            throw new Error("Repository does not exist locally");
        }

        if (!(await isDockerApp(localRepoPath))) {
            throw new Error("Repository does not contain any docker files");
        }

        const runner = new CommandRunner(localRepoPath);

        const build = await runner.run("docker compose build --no-cache");
        if (build.error) {
            console.error("build", build);
            throw new Error("Docker failed to build");
        }

        // Use --force-recreate and --remove-orphans together to ensure fresh containers and cleanup
        const compose = await runner.run(
            `docker compose up -d --force-recreate --remove-orphans`,
        );
        if (compose.error) {
            console.error("compose", compose);
            throw new Error("Error composing docker app");
        }

        //Docker app is starting in the background, other routes will handle docker app status!
    }
}
