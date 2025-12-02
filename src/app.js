import fastifyAutoload from "@fastify/autoload";
import env from "@fastify/env";
import { folderExists } from "#utils/filesystem";

import path from "path";
const __dirname = import.meta.dirname;

const schema = {
    type: "object",
    required: ["PORT"],
    properties: {
        RATE_LIMIT_MAX: {
            type: "number",
            default: 100,
        },
    },
};

export default async (fastify, opts) => {
    await fastify.register(env, {
        confKey: "config",
        schema,
        dotenv: true,
        data: process.env,
    });
    const externalPlugins = path.join(__dirname, "plugins/external");
    const appPlugins = path.join(__dirname, "plugins/app");

    if (folderExists(externalPlugins)) {
        await fastify.register(fastifyAutoload, {
            dir: externalPlugins,
            options: { ...opts },
        });
    }
    if (folderExists(appPlugins)) {
        await fastify.register(fastifyAutoload, {
            dir: appPlugins,
            options: { ...opts },
        });
    }

    fastify.register(fastifyAutoload, {
        dir: path.join(__dirname, "routes"),
        autoHooks: true,
        routeParams: true,
        cascadeHooks: true,
        options: { ...opts },
    });

    fastify.setErrorHandler((err, request, reply) => {
        fastify.log.error(
            {
                err,
                request: {
                    method: request.method,
                    url: request.url,
                    query: request.query,
                    params: request.params,
                },
            },
            "Unhandled error occurred"
        );
        reply.code(err.statusCode ?? 500);
        let message = "Internal Server Error";
        if (err.statusCode && err.statusCode < 500) {
            message = err.message;
        }
        return { message };
    });

    fastify.setNotFoundHandler(
        {
            preHandler: fastify.rateLimit({
                max: 3,
                timeWindow: 500,
            }),
        },
        (request, reply) => {
            request.log.warn(
                {
                    request: {
                        method: request.method,
                        url: request.url,
                        query: request.query,
                        params: request.params,
                    },
                },
                "Resource not found"
            );
            reply.code(404);
            return { message: "Not Found" };
        }
    );
};
