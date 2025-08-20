import { GRID_THEMES } from "../constants.js";

export function drawGridOverlay(ctx, pixelSize, blockCount) {
  const themeName = document.getElementById("gridTheme")?.value || "contrast";
  const theme = GRID_THEMES[themeName] || GRID_THEMES.contrast;

  const thinPct = Math.max(
    0.06,
    parseInt(document.getElementById("thinWidth")?.value || "10", 10) / 100
  );
  const majorPct = Math.max(
    0.18,
    parseInt(document.getElementById("majorWidth")?.value || "34", 10) / 100
  );
  const N = Math.max(
    2,
    parseInt(document.getElementById("majorEvery")?.value || "16", 10)
  );
  const perCell = !!document.getElementById("gridAutoPerCell")?.checked;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const thinHaloW = Math.max(1, Math.floor(pixelSize * (thinPct * 1.8)));
  const thinLineW = Math.max(1, Math.floor(pixelSize * (thinPct * 1.0)));
  const majorOutW = Math.max(2, Math.floor(pixelSize * (majorPct * 1.0)));
  const majorInW = Math.max(1, Math.floor(pixelSize * (majorPct * 0.45)));

  // 白ハロー
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = thinHaloW;
  for (let i = 1; i < blockCount; i++) {
    const pos = i * pixelSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, blockCount * pixelSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(blockCount * pixelSize, pos);
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(majorOutW, thinHaloW + 1);
  for (let i = N; i < blockCount; i += N) {
    const pos = i * pixelSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, blockCount * pixelSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(blockCount * pixelSize, pos);
    ctx.stroke();
  }

  // 細線（固定色）
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = theme.thin;
  ctx.lineWidth = thinLineW;
  if (!perCell) {
    for (let i = 1; i < blockCount; i++) {
      const pos = i * pixelSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, blockCount * pixelSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(blockCount * pixelSize, pos);
      ctx.stroke();
    }
  } else {
    for (let gx = 1; gx < blockCount; gx++) {
      const x = gx * pixelSize + 0.5;
      for (let gy = 0; gy < blockCount; gy++) {
        const y0 = gy * pixelSize,
          y1 = (gy + 1) * pixelSize;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
        ctx.stroke();
      }
    }
    for (let gy = 1; gy < blockCount; gy++) {
      const y = gy * pixelSize + 0.5;
      for (let gx = 0; gx < blockCount; gx++) {
        const x0 = gx * pixelSize,
          x1 = (gx + 1) * pixelSize;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }
    }
  }

  // 強調（外→内）
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = theme.majorOuter;
  ctx.lineWidth = majorOutW;
  for (let i = N; i < blockCount; i += N) {
    const pos = i * pixelSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, blockCount * pixelSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(blockCount * pixelSize, pos);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = theme.majorInner;
  ctx.lineWidth = majorInW;
  if (!perCell) {
    for (let i = N; i < blockCount; i += N) {
      const pos = i * pixelSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, blockCount * pixelSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(blockCount * pixelSize, pos);
      ctx.stroke();
    }
  } else {
    for (let gx = N; gx < blockCount; gx += N) {
      const x = gx * pixelSize + 0.5;
      for (let gy = 0; gy < blockCount; gy++) {
        const y0 = gy * pixelSize,
          y1 = (gy + 1) * pixelSize;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
        ctx.stroke();
      }
    }
    for (let gy = N; gy < blockCount; gy += N) {
      const y = gy * pixelSize + 0.5;
      for (let gx = 0; gx < blockCount; gx++) {
        const x0 = gx * pixelSize,
          x1 = (gx + 1) * pixelSize;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}
