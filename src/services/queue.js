const queue = [];
const jobs = new Map();
let isProcessing = false;
const JOB_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day in milliseconds

const purgeExpiredJobs = () => {
    const now = Date.now();
    for (const [id, job] of jobs) {
        if (now - job.createdAt > JOB_EXPIRY_MS) {
            jobs.delete(id);
        }
    }
};
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    purgeExpiredJobs();

    const job = queue.shift();

    job.logStatus("running", "Job started processing");

    try {
        await job.run();
        job.logStatus("done", "Job completed successfully");
    } catch (err) {
        job.logStatus("error", `Job failed: ${err.message}`);
        console.error(`Job ${job.id} failed`, err);
    }

    isProcessing = false;

    if (queue.length > 0) {
        setImmediate(processQueue);
    }
};

export const addJob = (job) => {
    jobs.set(job.id, job);
    queue.push(job);
    processQueue();
};

export const getJobById = (id) => {
    let job = jobs.get(id);
    delete job?.env;
    return job;
};

export const getAllJobs = () => {
    return Array.from(jobs, ([jobid, jobData]) => jobid);
};
