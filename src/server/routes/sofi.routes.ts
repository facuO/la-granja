import type { FastifyPluginAsync } from "fastify";
import { query } from "../db.js";
import { setSofiCookie } from "../auth/cookies.js";

export const sofiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { token: string } }>("/s/:token", async (req, reply) => {
    const { rows } = await query<{ id: string; revoked_at: Date | null }>(
      `SELECT id, revoked_at FROM sofi_tokens WHERE token = $1`,
      [req.params.token]
    );

    if (rows.length === 0 || rows[0].revoked_at) {
      return reply.code(401).type("text/html").send(`
        <html><body>
          <p>Este link no funciona. Pedile a Papá uno nuevo.</p>
        </body></html>
      `);
    }

    setSofiCookie(reply, req.params.token);
    return reply.redirect("/sofi.html");
  });
};
