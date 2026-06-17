import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/healthz", async () => {
    return { status: "ok", time: new Date().toISOString() };
  });
};
