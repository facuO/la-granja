import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { config } from "./config.js";
import { closePool } from "./db.js";

export async function buildApp() {
  const app = Fastify({
    logger: config.nodeEnv === "development"
      ? { transport: { target: "pino-pretty" } }
      : true,
  });

  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(healthRoutes);
  await app.register(authRoutes);

  return app;
}

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    try {
      await app.close();
      await closePool();
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
