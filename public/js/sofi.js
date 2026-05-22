import { api } from "./api.js";

// Pictogramas ARASAAC por materia (lookup por nombre).
const SUBJECT_ICONS = {
  "Ciencias Sociales": 35402,
  "Lengua": 10259,
  "Matemática": 32554,
  "Ciencias Naturales": 32542,
};

// Orden fijo para estabilidad visual (no depende del orden del server).
const SUBJECT_ORDER = ["Ciencias Sociales", "Lengua", "Matemática", "Ciencias Naturales"];

async function init() {
  const root = document.getElementById("materias");
  try {
    const { subjects } = await api("/api/sofi/subjects");
    if (!subjects.length) {
      root.textContent = "Todavía no hay materias. Avisale a Papá.";
      return;
    }
    const sorted = [...subjects].sort((a, b) => {
      const ai = SUBJECT_ORDER.indexOf(a.name);
      const bi = SUBJECT_ORDER.indexOf(b.name);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    for (const subject of sorted) {
      const card = document.createElement("a");
      card.className = "materia-card";
      card.href = `/materia.html?id=${encodeURIComponent(subject.id)}`;
      const picId = SUBJECT_ICONS[subject.name];
      if (picId) {
        const img = document.createElement("img");
        img.src = `https://static.arasaac.org/pictograms/${picId}/${picId}_500.png`;
        img.alt = subject.name;
        img.loading = "lazy";
        img.className = "materia-icon";
        card.appendChild(img);
      }
      const name = document.createElement("div");
      name.className = "materia-name";
      name.textContent = subject.name;
      card.appendChild(name);
      root.appendChild(card);
    }
  } catch (err) {
    root.textContent = "No pudimos cargar las materias. Probá refrescar.";
    console.error(err);
  }
}

init();
