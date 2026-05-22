import { Resend } from "resend";
import { config } from "../config.js";

const client = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export async function sendMagicLink(email: string, link: string): Promise<void> {
  const subject = "Tu acceso a tutor de Sofi";
  const html = `
    <p>Hola,</p>
    <p>Para ingresar al tutor de Sofi, hacé click en este link (vence en 15 minutos):</p>
    <p><a href="${link}">${link}</a></p>
    <p>Si no pediste este link, ignorá este mail.</p>
  `;

  if (!client || config.nodeEnv !== "production") {
    console.log("\n--- MAGIC LINK EMAIL ---");
    console.log("To:", email);
    console.log("Subject:", subject);
    console.log("Link:", link);
    console.log("------------------------\n");
    return;
  }

  await client.emails.send({
    from: config.emailFrom,
    to: email,
    subject,
    html,
  });
}
