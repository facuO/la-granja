import { api } from "./api.js";

const STATUS_LABEL = {
  featured: "← seguimos con esto",
  available: "",
  done: "ya visto",
  mastered: "repaso",
};

async function init() {
  const root = document.getElementById("subjects");
  try {
    const { subjects } = await api("/api/sofi/subjects");
    if (!subjects.length) {
      root.textContent = "Todavía no hay nada para ver. Avisale a Papá.";
      return;
    }
    for (const subject of subjects) {
      const h2 = document.createElement("h2");
      h2.textContent = subject.name;
      root.appendChild(h2);

      const list = document.createElement("div");
      list.className = "topic-list";
      for (const topic of subject.topics) {
        const btn = document.createElement("button");
        btn.className = "topic";
        btn.dataset.status = topic.status;
        btn.textContent = topic.title;
        if (STATUS_LABEL[topic.status]) {
          const badge = document.createElement("span");
          badge.className = "badge";
          badge.textContent = STATUS_LABEL[topic.status];
          btn.appendChild(badge);
        }
        btn.addEventListener("click", () => startSession(topic.id));
        list.appendChild(btn);
      }
      root.appendChild(list);
    }
  } catch (err) {
    root.textContent = "No pudimos cargar las materias. Probá refrescar.";
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
