import { findNearestColorRGB } from "../color/palette.js";
import { BLUE_NOISE_16, FLOYD, JJN, ATKINSON } from "./kernels.js";
import { renderMask } from "../render/preview.js";

// まずは「単純量子化」（ディザなし）
export function quantizeImageData(imageData, size, state) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const { rgb } = findNearestColorRGB(
      [data[i], data[i + 1], data[i + 2]],
      state
    );
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
}

// ==== ディザ（共通ユーティリティ） ====

// UI: ナチュラル強度（0..1）
function getNaturalStrengthRatio() {
  const enabled = !!document.getElementById("naturalDithering")?.checked;
  if (!enabled) return 1;
  const v = parseInt(
    document.getElementById("naturalStrength")?.value || "100",
    10
  );
  return Math.max(0, Math.min(1, v / 100));
}

// 近傍コントラストに基づくローカル強度（0.2..1）
function strengthLocal(x, y, pixels, size) {
  const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  const cL = lum(pixels[y][x]);
  const arr = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      arr.push(lum(pixels[ny][nx]));
    }
  }
  if (!arr.length) return 1;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const contrast = Math.sqrt(
    arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length
  );
  const gradient = Math.max(...arr.map((v) => Math.abs(v - cL)));
  return Math.max(0.2, Math.min(1, 1 - (contrast + gradient) / 40));
}

// 共通：誤差拡散（Floyd/JJN/Atkinson）
function ditherKernel(pixels, size, kernel, state) {
  const nat = !!document.getElementById("naturalDithering")?.checked;
  const g = getNaturalStrengthRatio();
  const mask = Array.from({ length: size }, () => Array(size).fill(1));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const old = pixels[y][x];
      const { rgb: nrgb } = findNearestColorRGB(old, state);
      const err = [old[0] - nrgb[0], old[1] - nrgb[1], old[2] - nrgb[2]];
      pixels[y][x] = nrgb;

      let s = 1;
      if (nat) s = strengthLocal(x, y, pixels, size) * g;
      mask[y][x] = s;

      for (const [dx, dy, f] of kernel) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        for (let c = 0; c < 3; c++) {
          pixels[ny][nx][c] = Math.max(
            0,
            Math.min(255, pixels[ny][nx][c] + err[c] * f * s)
          );
        }
      }
    }
  }

  if (nat) renderMask(mask, size);
}

// 16x16 ブルーノイズの順序ディザ（擬似）
function orderedBlueNoise(pixels, size, state) {
  const nat = !!document.getElementById("naturalDithering")?.checked;
  const g = getNaturalStrengthRatio();
  const mask = Array.from({ length: size }, () => Array(size).fill(1));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const old = pixels[y][x];
      const lum = 0.299 * old[0] + 0.587 * old[1] + 0.114 * old[2];
      const thr = BLUE_NOISE_16[y % 16][x % 16]; // 0..255
      const s = 0; // ← ブルーノイズの影響を強制ゼロ
      mask[y][x] = s; // （マスクは0で可視化してもOK）
      // ブルーノイズで明度を変えず、元色で最近傍のみ実行
      const { rgb } = findNearestColorRGB(old, state);
      pixels[y][x] = rgb;
    }
  }

  if (nat) renderMask(mask, size);
}

// ==== エントリーポイント ====

// method: 'floyd' | 'jjn' | 'atkinson' | 'ordered'
export function ditherImageData(imageData, size, method, state) {
  const data = imageData.data;
  // ピクセルアクセスを楽に
  const px = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const i = (y * size + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    })
  );

  if (method === "floyd") ditherKernel(px, size, FLOYD, state);
  else if (method === "jjn") ditherKernel(px, size, JJN, state);
  else if (method === "atkinson") ditherKernel(px, size, ATKINSON, state);
  else orderedBlueNoise(px, size, state);

  // 書き戻し
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const [r, g, b] = px[y][x];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
}


