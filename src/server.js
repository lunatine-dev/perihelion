import Fastify from "fastify";
import fp from "fastify-plugin";
import closeWithGrace from "close-with-grace";
import serviceApp from "./app.js";

import logger from "#constants/logger";

const app = Fastify({
    logger: logger[process.env.NODE_ENV || "development"] ?? true,
    trustProxy: process.env.NODE_ENV === "production",
});

const init = async () => {
    app.register(fp(serviceApp));

    closeWithGrace(
        {
            delay: 1000,
        },
        async ({ err }) => {
            if (err != null) app.log.error(err);
            await app.close();
        },
    );

    await app.ready();
    app.log.info("Plugins loaded");

    try {
        await app.listen({
            host: "0.0.0.0",
            port: process.env.PORT ?? 3000,
        });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

init();
