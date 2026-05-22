// Lightbox: click on .zoomable images to open a fullscreen overlay
// with the high-res version. Pinch-zoom and scroll work natively
// because the overlay image has no max-width constraint when zoomed.

function openLightbox(src, alt) {
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Mapa ampliado");

  const stage = document.createElement("div");
  stage.className = "lightbox-stage";

  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.className = "lightbox-img";
  stage.appendChild(img);

  const closeBtn = document.createElement("button");
  closeBtn.className = "lightbox-close";
  closeBtn.setAttribute("aria-label", "Cerrar");
  closeBtn.textContent = "✕ Cerrar";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  const hint = document.createElement("div");
  hint.className = "lightbox-hint";
  hint.textContent = "Pellizcá para hacer zoom · Ctrl + rueda · Tocá afuera para cerrar";

  overlay.appendChild(stage);
  overlay.appendChild(closeBtn);
  overlay.appendChild(hint);

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", onKey);
  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);
}

// Event delegation: catches clicks on any current OR future .zoomable img.
document.addEventListener("click", (e) => {
  const img = e.target.closest("img.zoomable");
  if (!img) return;
  const src = img.dataset.zoomSrc || img.src;
  openLightbox(src, img.alt || "");
});

// Add cursor hint to any existing zoomable images.
function refreshCursors() {
  document.querySelectorAll(".zoomable").forEach((img) => {
    img.style.cursor = "zoom-in";
  });
}
refreshCursors();
// Re-apply periodically since the session UI adds images dynamically.
new MutationObserver(refreshCursors).observe(document.body, {
  childList: true,
  subtree: true,
});
