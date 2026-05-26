// Vitest globalSetup-equivalent: corre antes de cualquier test file.
// Configura env vars que `src/server/config.ts` lee al importarse, así no
// tenemos que coordinar el orden de set-vs-import en cada test.
//
// GROQ_API_KEY puede ser cualquier string no vacío — los tests que tocan el
// LLM mockean `groq-sdk` o `chatJson`, así que la key nunca llega a la red.

if (!process.env.GROQ_API_KEY) {
  process.env.GROQ_API_KEY = "test-key-mocked-never-used-in-tests";
}
