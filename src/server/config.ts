import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  cookieSecret: required("COOKIE_SECRET"),
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "sofi_session",
  sofiCookieName: process.env.SOFI_COOKIE_NAME ?? "sofi_device",
  parentCookieMaxDays: Number(process.env.PARENT_COOKIE_MAX_DAYS ?? 30),
  sofiCookieMaxDays: Number(process.env.SOFI_COOKIE_MAX_DAYS ?? 90),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  parentEmail: required("PARENT_EMAIL"),
  adminPassword: process.env.ADMIN_PASSWORD ?? "1234",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
};
