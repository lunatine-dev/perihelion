export default async function (fastify) {
    fastify.get("/ping", (request, reply) => {
        //just a test for server readiness
        return {
            message: "Pong!",
            timestamp: Date.now(),
        };
    });
}
