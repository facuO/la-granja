import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // Excluir worktrees de agentes paralelos para que vitest no recoja
    // copias de los tests que viven ahí. Por defecto vitest no cubre
    // .claude/ — agregamos explícito.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.claude/**",
      "**/.git/**",
    ],
    setupFiles: ["./tests/setup.ts"],
  },
});
