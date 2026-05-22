import Fastify from "fastify";
import { healthRoutes } from "./routes/health.routes.js";
import dotenv from "dotenv";

dotenv.config();

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty" } }
      : true,
  });

  await app.register(healthRoutes);

  return app;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
