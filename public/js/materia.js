import { api } from "./api.js";

const SUBJECT_ICONS = {
  "Ciencias Sociales": 35402,
  "Lengua": 10259,
  "Matemática": 32554,
  "Ciencias Naturales": 32542,
};

const params = new URLSearchParams(window.location.search);
const subjectId = params.get("id");

const headerEl = document.getElementById("materia-header");
const topicsEl = document.getElementById("topics");

async function init() {
  if (!subjectId) {
    topicsEl.textContent = "Falta el id de la materia.";
    return;
  }
  try {
    const { subjects } = await api("/api/sofi/subjects");
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) {
      topicsEl.textContent = "No encontramos esa materia.";
      return;
    }

    // Header
    const picId = SUBJECT_ICONS[subject.name];
    if (picId) {
      const img = document.createElement("img");
      img.src = `https://static.arasaac.org/pictograms/${picId}/${picId}_300.png`;
      img.alt = subject.name;
      img.className = "materia-header-icon";
      headerEl.appendChild(img);
    }
    const h1 = document.createElement("h1");
    h1.textContent = subject.name;
    h1.className = "materia-header-name";
    headerEl.appendChild(h1);

    // Topics
    if (!subject.topics || subject.topics.length === 0) {
      const empty = document.createElement("p");
      empty.className = "materia-empty";
      empty.textContent = "Todavía no hay temas para explorar en esta materia. Pronto vamos a sumar.";
      topicsEl.appendChild(empty);
      return;
    }

    for (const topic of subject.topics) {
      const btn = document.createElement("button");
      btn.className = "topic";
      btn.dataset.status = topic.status;
      btn.textContent = topic.title;
      btn.addEventListener("click", () => startSession(topic.id));
      topicsEl.appendChild(btn);
    }
  } catch (err) {
    topicsEl.textContent = "No pudimos cargar la materia. Probá refrescar.";
    console.error(err);
  }
}

async function startSession(topicId) {
  try {
    const { session_id, steps_planned } = await api("/api/sofi/sessions", {
      method: "POST",
      body: { topic_id: topicId },
    });
    const total = steps_planned ?? 0;
    window.location.href = `/session.html?id=${session_id}&total=${total}`;
  } catch (err) {
    alert("No se pudo empezar. Probá de nuevo.");
    console.error(err);
  }
}

init();
