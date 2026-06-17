// Memorama de animales de granja. Sin reloj, sin contador de intentos.
// Las cartas usan pictogramas ARASAAC. Mecánica:
//  1. Sofi toca una carta → se da vuelta y muestra el pictograma.
//  2. Toca una segunda carta → si matchea, ambas quedan abiertas (verde).
//     Si no matchea, tras 1.5s las dos se vuelven a tapar.
//  3. Cuando todas las cartas matchean → mensaje de victoria.

const ANIMALES = [
  { id: "vaca",     pic: 2609, label: "Vaca" },
  { id: "oveja",    pic: 2489, label: "Oveja" },
  { id: "gallina",  pic: 2403, label: "Gallina" },
  { id: "cerdo",    pic: 24972, label: "Cerdo" },
  { id: "caballo",  pic: 2294, label: "Caballo" },
  { id: "pollito",  pic: 2533, label: "Pollito" },
  { id: "perro",    pic: 7202, label: "Perro" },
  { id: "gato",     pic: 7114, label: "Gato" },
];

const gridEl = document.getElementById("memory-grid");
const winEl = document.getElementById("memory-win");
const playAgainBtn = document.getElementById("play-again");
const difBtns = document.querySelectorAll(".dif-btn");

let pairsCount = 6;
let firstFlipped = null;
let busy = false;
let matched = 0;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setupGame() {
  firstFlipped = null;
  busy = false;
  matched = 0;
  winEl.style.display = "none";
  gridEl.innerHTML = "";
  gridEl.style.display = "grid";

  const chosen = shuffle(ANIMALES).slice(0, pairsCount);
  const deck = shuffle([...chosen, ...chosen]); // cada animal x2

  // Columnas según cantidad de cartas
  const total = deck.length;
  const cols = total <= 8 ? 4 : total <= 12 ? 4 : 4;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  deck.forEach((animal, idx) => {
    const card = document.createElement("button");
    card.className = "mem-card";
    card.dataset.id = animal.id;
    card.dataset.idx = String(idx);
    card.setAttribute("aria-label", `Carta ${idx + 1}`);

    const inner = document.createElement("div");
    inner.className = "mem-card-inner";

    const back = document.createElement("div");
    back.className = "mem-face mem-back";
    back.textContent = "?";

    const front = document.createElement("div");
    front.className = "mem-face mem-front";
    const img = document.createElement("img");
    img.src = `https://static.arasaac.org/pictograms/${animal.pic}/${animal.pic}_300.png`;
    img.alt = animal.label;
    img.loading = "lazy";
    front.appendChild(img);
    const lbl = document.createElement("span");
    lbl.className = "mem-label";
    lbl.textContent = animal.label.toUpperCase();
    front.appendChild(lbl);

    inner.appendChild(back);
    inner.appendChild(front);
    card.appendChild(inner);

    card.addEventListener("click", () => onFlip(card, animal));
    gridEl.appendChild(card);
  });
}

function onFlip(card, animal) {
  if (busy) return;
  if (card.classList.contains("flipped") || card.classList.contains("matched")) return;

  card.classList.add("flipped");

  if (!firstFlipped) {
    firstFlipped = { card, animal };
    return;
  }

  // segunda carta
  busy = true;
  if (firstFlipped.animal.id === animal.id) {
    // match
    setTimeout(() => {
      firstFlipped.card.classList.add("matched");
      card.classList.add("matched");
      firstFlipped = null;
      busy = false;
      matched++;
      if (matched === pairsCount) showWin();
    }, 500);
  } else {
    // no match — voltear ambas
    setTimeout(() => {
      firstFlipped.card.classList.remove("flipped");
      card.classList.remove("flipped");
      firstFlipped = null;
      busy = false;
    }, 1500);
  }
}

function showWin() {
  setTimeout(() => {
    winEl.style.display = "block";
  }, 600);
}

difBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    difBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    pairsCount = parseInt(btn.dataset.pairs, 10);
    setupGame();
  });
});

playAgainBtn.addEventListener("click", setupGame);

setupGame();
