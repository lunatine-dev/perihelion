import fastifyRateLimit from "@fastify/rate-limit";
export const autoConfig = (fastify) => {
    return {
        max: fastify.config.RATE_LIMIT_MAX,
        timeWindow: "1 minute",
    };
};
export default fastifyRateLimit;
