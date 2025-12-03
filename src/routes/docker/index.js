import { getDockerContainer, getDockerContainers } from "#services/docker";

export default async function (fastify) {
    fastify.get("/containers", async (req, res) => {
        return await getDockerContainers();
    });
    fastify.get("/containers/github/:repo_id", async (req, res) => {
        return await getDockerContainer(req.params.repo_id);
    });
}
