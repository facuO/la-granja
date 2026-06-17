import { buildApp } from "../../src/server/index.js";
import type { FastifyInstance } from "fastify";

export async function makeTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}
