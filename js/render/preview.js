import { drawGridOverlay } from "./grid.js";
import { drawGuides } from "./guides.js";
import { els } from "../ui/elements.js";

export function computeScale(size) {
  return Math.max(4, Math.min(16, Math.floor(800 / size)));
}

export function renderPreviewFrom(canvas, size, state) {
  const scale = computeScale(size);
  const disp = els.displayCanvas;
  const dctx = disp.getContext("2d");

  disp.width = disp.height = size * scale;
  dctx.imageSmoothingEnabled = false;
  dctx.clearRect(0, 0, disp.width, disp.height);
  dctx.drawImage(canvas, 0, 0, disp.width, disp.height);

  drawGridOverlay(dctx, scale, size);
  drawGuides(dctx, canvas, size, scale, state);

  const guideBtn = document.getElementById("downloadGuideBtn");
  if (guideBtn) guideBtn.disabled = false;
}

export function renderMask(mask, size) {
  const ctx = els.maskCanvas.getContext("2d");
  els.maskCanvas.width = els.maskCanvas.height = size;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const v = Math.max(
        0,
        Math.min(255, Math.round((mask?.[y]?.[x] ?? 1) * 255))
      );
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
export function rerenderIfReady(state) {
  const size = els.resultCanvas?.width | 0;
  if (size > 0) {
    renderPreviewFrom(els.resultCanvas, size, state);
  }
}
