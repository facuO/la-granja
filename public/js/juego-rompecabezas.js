// Rompecabezas tap-to-place (sin drag-and-drop, accesible para Sofi).
//
// Mecánica:
//  1. Sofi ve la imagen objetivo con N slots vacíos numerados.
//  2. Abajo, banco con N piezas desordenadas (cada una es un recorte de
//     la imagen via CSS background-position).
//  3. Tap en una pieza → se marca seleccionada (highlight).
//  4. Tap en un slot → si el slot espera esa pieza, snap (la pieza se
//     pega ahí). Si no, la pieza se deselecciona (sin penalización).
//  5. Cuando todos los slots están llenos → la imagen queda completa.

const ANIMALES = {
  vaca:    { pic: 2609, label: "Vaca" },
  gallina: { pic: 2403, label: "Gallina" },
  pollito: { pic: 2533, label: "Pollito" },
  caballo: { pic: 2294, label: "Caballo" },
};

const targetEl = document.getElementById("puzzle-target");
const bankEl = document.getElementById("puzzle-bank");
const winEl = document.getElementById("puzzle-win");
const playAgainBtn = document.getElementById("play-again-pz");
const animalBtns = document.querySelectorAll(".animal-btn");
const sizeBtns = document.querySelectorAll(".size-btn");

let currentAnimal = "vaca";
let size = 3; // grilla NxN
let selectedPiece = null;
let placed = 0;

function imageUrl(pic) {
  return `https://static.arasaac.org/pictograms/${pic}/${pic}_500.png`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setupPuzzle() {
  selectedPiece = null;
  placed = 0;
  winEl.style.display = "none";

  const animal = ANIMALES[currentAnimal];
  const url = imageUrl(animal.pic);
  const N = size; // NxN
  const totalPieces = N * N;
  const cellPercent = 100 / N;

  // Target: grilla NxN de slots vacíos
  targetEl.innerHTML = "";
  targetEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  targetEl.style.gridTemplateRows = `repeat(${N}, 1fr)`;

  for (let i = 0; i < totalPieces; i++) {
    const slot = document.createElement("div");
    slot.className = "puzzle-slot";
    slot.dataset.index = String(i);
    slot.addEventListener("click", () => onSlotTap(slot, i));
    targetEl.appendChild(slot);
  }

  // Bank: piezas desordenadas. Cada pieza muestra una porción de la imagen.
  bankEl.innerHTML = "";
  const indices = shuffle([...Array(totalPieces).keys()]);
  for (const i of indices) {
    const row = Math.floor(i / N);
    const col = i % N;
    const piece = document.createElement("button");
    piece.type = "button";
    piece.className = "puzzle-piece";
    piece.dataset.index = String(i);
    piece.style.backgroundImage = `url(${url})`;
    piece.style.backgroundSize = `${N * 100}% ${N * 100}%`;
    piece.style.backgroundPosition = `${(col / (N - 1 || 1)) * 100}% ${(row / (N - 1 || 1)) * 100}%`;
    piece.setAttribute("aria-label", `Pieza ${i + 1} de ${totalPieces}`);
    piece.addEventListener("click", () => onPieceTap(piece));
    bankEl.appendChild(piece);
  }
}

function onPieceTap(piece) {
  if (piece.classList.contains("placed")) return;
  if (selectedPiece === piece) {
    piece.classList.remove("selected");
    selectedPiece = null;
    return;
  }
  if (selectedPiece) selectedPiece.classList.remove("selected");
  selectedPiece = piece;
  piece.classList.add("selected");
}

function onSlotTap(slot, slotIdx) {
  if (!selectedPiece) return;
  if (slot.classList.contains("filled")) return;
  const pieceIdx = parseInt(selectedPiece.dataset.index, 10);
  if (pieceIdx === slotIdx) {
    // Match: mover la pieza al slot
    slot.appendChild(selectedPiece);
    selectedPiece.classList.remove("selected");
    selectedPiece.classList.add("placed");
    slot.classList.add("filled");
    selectedPiece = null;
    placed++;
    if (placed === size * size) showWin();
  } else {
    // No match: deseleccionar (sin penalización)
    selectedPiece.classList.remove("selected");
    selectedPiece = null;
  }
}

function showWin() {
  setTimeout(() => {
    winEl.style.display = "block";
  }, 400);
}

animalBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    animalBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentAnimal = btn.dataset.animal;
    setupPuzzle();
  });
});

sizeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    sizeBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    size = parseInt(btn.dataset.size, 10);
    setupPuzzle();
  });
});

playAgainBtn.addEventListener("click", setupPuzzle);

setupPuzzle();
