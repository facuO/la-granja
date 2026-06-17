// Encontrá los animales: escena con animales mezclados. Sofi tap en los
// del tipo pedido. Sin penalización al equivocarse (silencio amable).
//
// Mecánica:
//  1. Se elige un animal objetivo (ej. vacas) y una cantidad (3-4).
//  2. La escena tiene 12 animales total: el objetivo + distractores.
//  3. Sofi tap en cada animal: si es del tipo objetivo → highlight verde.
//     Si no → no pasa nada (la app no la regaña).
//  4. Cuando encuentra todos los del objetivo → mensaje de victoria.

const ZOO = [
  { id: "vaca",    pic: 2609, label: "vacas" },
  { id: "oveja",   pic: 2489, label: "ovejas" },
  { id: "gallina", pic: 2403, label: "gallinas" },
  { id: "cerdo",   pic: 24972, label: "cerdos" },
  { id: "caballo", pic: 2294, label: "caballos" },
  { id: "pollito", pic: 2533, label: "pollitos" },
  { id: "perro",   pic: 7202, label: "perros" },
  { id: "gato",    pic: 7114, label: "gatos" },
];

const TARGET_COUNT = 3;     // cuántos del tipo objetivo
const DISTRACTOR_COUNT = 9; // total escena = 12 animales

const sceneEl = document.getElementById("encontrar-scene");
const consignaEl = document.getElementById("encontrar-consigna");
const winEl = document.getElementById("encontrar-win");
const playAgainBtn = document.getElementById("play-again-en");

let foundCount = 0;
let needed = 0;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setupRound() {
  foundCount = 0;
  needed = TARGET_COUNT;
  winEl.style.display = "none";
  sceneEl.innerHTML = "";

  const shuffledZoo = shuffle(ZOO);
  const target = shuffledZoo[0];
  const distractors = shuffledZoo.slice(1, 1 + 4); // 4 tipos distractor

  consignaEl.textContent = `Tocá las ${TARGET_COUNT} ${target.label} que veas.`;

  // Construir la población: TARGET_COUNT del objetivo + DISTRACTOR_COUNT mezclados de distractores
  const population = [];
  for (let i = 0; i < TARGET_COUNT; i++) population.push({ ...target, isTarget: true });
  for (let i = 0; i < DISTRACTOR_COUNT; i++) {
    const d = distractors[i % distractors.length];
    population.push({ ...d, isTarget: false });
  }

  // Distribuir en una grilla 3x4
  const arranged = shuffle(population);
  arranged.forEach((animal) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "encontrar-animal";
    cell.dataset.isTarget = String(animal.isTarget);
    cell.setAttribute("aria-label", animal.id);
    const img = document.createElement("img");
    img.src = `https://static.arasaac.org/pictograms/${animal.pic}/${animal.pic}_300.png`;
    img.alt = animal.id;
    img.loading = "lazy";
    cell.appendChild(img);
    cell.addEventListener("click", () => onTap(cell, animal));
    sceneEl.appendChild(cell);
  });
}

function onTap(cell, animal) {
  if (cell.classList.contains("found")) return;
  if (animal.isTarget) {
    cell.classList.add("found");
    foundCount++;
    if (foundCount >= needed) {
      setTimeout(() => { winEl.style.display = "block"; }, 500);
    }
  } else {
    // Distractor: ligero shake visual, sin sonido feo, sin restar puntos
    cell.classList.add("nope");
    setTimeout(() => cell.classList.remove("nope"), 350);
  }
}

playAgainBtn.addEventListener("click", setupRound);

setupRound();
