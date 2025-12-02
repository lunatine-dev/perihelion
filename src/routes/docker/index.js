import { getDockerContainers } from "#services/docker";

export default async function (fastify) {
    fastify.get("/containers", async (req, res) => {
        return await getDockerContainers();
    });
}
