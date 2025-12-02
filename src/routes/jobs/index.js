import { getJobById, getAllJobs } from "#services/queue";
import { CloneJob, DockerJob } from "#services/jobs";
import { addJob } from "#services/queue";

export default async function (fastify) {
    fastify.get("/", (req, res) => {
        return getAllJobs();
    });
    fastify.get("/:job", (req, res) => {
        const job = getJobById(req.params?.job);

        if (!job) return res.notFound("Job not found");

        return job;
    });
    fastify.post("/create", (req, res) => {
        const { type, owner, repo, env } = req.body;

        if (!type || !owner || !repo) return res.badRequest();

        let job;

        if (type === "docker") {
            job = new DockerJob(owner, repo);
        } else if (type === "clone") {
            job = new CloneJob(owner, repo, env);
        }

        if (!job) return res.badRequest();

        addJob(job);

        return { message: "Job added to queue", jobId: job.id };
    });
}
