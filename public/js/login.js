import { api } from "./api.js";

const form = document.getElementById("login-form");
const status = document.getElementById("status");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  status.textContent = "Enviando...";
  try {
    await api("/api/auth/request-magic-link", { method: "POST", body: { email } });
    status.textContent = "Si el email está autorizado, recibiste un link. Revisá tu mail.";
  } catch (err) {
    status.textContent = "Error. Probá de nuevo.";
    console.error(err);
  }
});
