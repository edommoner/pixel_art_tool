import { els } from "../ui/elements.js";

let symbolMap = new Map(); // "r,g,b" -> "1.."

export function buildSymbolMap(state) {
  const syms = [];
  for (let i = 1; i <= 999; i++) syms.push(String(i));
  symbolMap.clear();
  state.activePalette.forEach(([r, g, b, id, label], idx) => {
    const key = `${r},${g},${b}`;
    if (!symbolMap.has(key)) symbolMap.set(key, syms[idx] || String(idx + 1));
  });
}

export function drawGuides(ctx, srcCanvas, size, scale, state) {
  const showOutline = !!document.getElementById("showOutline")?.checked;
  const showSymbols = !!document.getElementById("showSymbols")?.checked;
  if (!showOutline && !showSymbols) {
    els.legend.innerHTML = "";
    return;
  }

  const src = srcCanvas.getContext("2d").getImageData(0, 0, size, size).data;

  if (showOutline) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.globalAlpha = 0.9;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const r = src[i],
          g = src[i + 1],
          b = src[i + 2];
        const neighbors = [
          [x + 1, y],
          [x, y + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx >= size || ny >= size) continue;
          const j = (ny * size + nx) * 4;
          if (r !== src[j] || g !== src[j + 1] || b !== src[j + 2]) {
            ctx.beginPath();
            ctx.moveTo((x + 1) * scale + 0.5, y * scale);
            ctx.lineTo((x + 1) * scale + 0.5, (y + 1) * scale);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x * scale, (y + 1) * scale + 0.5);
            ctx.lineTo((x + 1) * scale, (y + 1) * scale + 0.5);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  if (showSymbols) {
    if (symbolMap.size === 0) buildSymbolMap(state);
    const scaleMul = Math.max(
      0.5,
      parseInt(document.getElementById("symbolScale")?.value || "100", 10) / 100
    );
    const fontPx = Math.max(8, Math.floor(scale * 0.7 * scaleMul));

    ctx.save();
    ctx.font = `${fontPx}px ui-monospace,Consolas,monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const key = `${src[i]},${src[i + 1]},${src[i + 2]}`;
        const sym = symbolMap.get(key) || "?";
        const cx = x * scale + scale / 2;
        const cy = y * scale + scale / 2;
        const off = Math.max(0.5, Math.round(fontPx / 16));
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillText(sym, cx + off, cy + off);
        ctx.fillStyle = "rgba(255,255,255,0.97)";
        ctx.fillText(sym, cx, cy);
      }
    }
    ctx.restore();

    // 凡例
    els.legend.innerHTML = "";
    const seen = new Set();
    for (const [r, g, b, id, label] of state.activePalette) {
      const key = `${r},${g},${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sym = symbolMap.get(key);
      const div = document.createElement("div");
      div.className = "lg";
      const sw = document.createElement("div");
      sw.className = "sym";
      sw.style.background = `rgb(${r},${g},${b})`;
      sw.textContent = sym;
      const txt = document.createElement("div");
      txt.innerHTML = `<div style="font-weight:600">${label || id}</div><div class="muted" style="font-family:monospace">${id}</div>`;
      div.appendChild(sw);
      div.appendChild(txt);
      els.legend.appendChild(div);
    }
  } else {
    els.legend.innerHTML = "";
  }
}
