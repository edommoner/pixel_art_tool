// js/dither/oklab-guided-natural.js
// 高品質：OKLab/OKLChベース +（任意）Guided Filter + Unsharp + 選択的ブルーノイズFS
// 使い方（例）:
//   import { convertWithOklabGuidedDitherV2 } from "./dither/oklab-guided-natural.js";
//   convertWithOklabGuidedDitherV2(img, size, state, { useDither: true });

export function convertWithOklabGuidedDitherV2(img, width, state, opts = {}) {
  const height = Math.floor(img.data.length / 4 / width);
  const N = width * height;
  if (!N) return;

  // --- パレット（許可セットで厳密フィルタ） ---
  let palette =
    (state?.paletteSnapshot?.length
      ? state.paletteSnapshot
      : state?.activePalette) || [];
  const allow = normalizeAllowSets(opts.allow ?? detectAllowedFromUI());
  const filtered = filterPaletteByAllowedSets(palette, allow);
  palette = filtered; // 必ず適用（emptyも許容してfail-fast）
  if (!palette.length) {
    console.warn("No colors allowed by current palette selection.");
    return;
  }

  // --- オプション（エッジ強め・白化対策寄り） ---
  const {
    // Guided Filter は既定OFF（必要な時だけON）
    preSmooth = false,
    r = 1,
    eps = 5e-3,

    useDither = true,
    serpentine = true,
    edgeAware = true,
    edgeT = 0.28,
    edgeSlope = 0.1,

    natural = true, // ブルーノイズ位相
    naturalStrength = 0.035, // L* ±3.5%程度

    // LChの重み（彩度優先／白化抑制）
    wL = 0.6,
    wC = 1.25,
    wH = 1.0,

    // 低彩度（灰・白）吸着の抑制
    grayBias = 0.18,
    // “ほぼ白”への吸着抑制（肌色など保護）
    whiteGuardL = 0.3,
    whiteGuardC = 0.2,

    // 素材ペナルティ係数（UI重みの違反コスト）
    penaltyK = 0.18,
  } = opts;

  // --- パレットを OKLab/LCh に ---
  const palLab = palette.map((p) => {
    const r = +p[0] | 0,
      g = +p[1] | 0,
      b = +p[2] | 0;
    const [L, A, B] = srgbToOklab_lut(r, g, b);
    const [, C, h] = labToLch(L, A, B);
    return {
      L,
      A,
      B,
      C,
      h,
      r,
      g,
      b,
      id: p[3] || "",
      pen: matPenalty(p[3] || ""),
    };
  });

  // --- 入力を OKLab に ---
  const Lbuf = new Float32Array(N);
  const Abuf = new Float32Array(N);
  const Bbuf = new Float32Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    const [L, A, B] = srgbToOklab_lut(
      img.data[j],
      img.data[j + 1],
      img.data[j + 2]
    );
    Lbuf[i] = L;
    Abuf[i] = A;
    Bbuf[i] = B;
  }

  // --- （任意）Guided Filter 前処理 ---
  if (preSmooth) {
    guidedFilterInplaceSafe(Lbuf, width, height, r, eps);
    // A/Bは縮み過ぎないようクリップ
    guidedFollowSafe(Lbuf, Abuf, width, height, r, eps, 0.6);
    guidedFollowSafe(Lbuf, Bbuf, width, height, r, eps, 0.6);
  }

  // --- L* を軽くシャープ（輪郭の芯を戻す） ---
  unsharpL_inplace(
    Lbuf,
    width,
    height,
    /*amount=*/ 0.6,
    /*radius=*/ 1,
    /*passes=*/ 2
  );

  // --- 選択的ディザ用のエッジ量 ---
  const edge = edgeAware ? sobelMagnitude(Lbuf, width, height) : null;

  // --- ブルーノイズ（なければBayer 8x8） ---
  const BN = typeof BLUE_NOISE_16 !== "undefined" ? BLUE_NOISE_16 : BAYER_8x8;
  const bh = BN.length,
    bw = BN[0].length;
  const bnAt = (x, y) => (BN[y % bh][x % bw] - 128) / 255; // -0.5..0.5

  // --- 誤差拡散バッファ（OKLab） ---
  const eL = useDither ? new Float32Array(N) : null;
  const eA = useDither ? new Float32Array(N) : null;
  const eB = useDither ? new Float32Array(N) : null;
  const idx = (x, y) => y * width + x;

  // --- 走査 ---
  for (let y = 0; y < height; y++) {
    const x0 = serpentine && y & 1 ? width - 1 : 0;
    const x1 = serpentine && y & 1 ? -1 : width;
    const step = serpentine && y & 1 ? -1 : 1;

    for (let x = x0; x !== x1; x += step) {
      const k = idx(x, y);

      // 入力 + 誤差 + ナチュラル位相
      let L = Lbuf[k] + (eL ? eL[k] : 0);
      let A = Abuf[k] + (eA ? eA[k] : 0);
      let B = Bbuf[k] + (eB ? eB[k] : 0);
      if (natural && naturalStrength > 0) L += naturalStrength * bnAt(x, y);

      // ===== 最近傍（OKLCh）+ 各種ガード =====
      const Csrc = Math.hypot(A, B);
      const hsrc = Math.atan2(B, A);
      let best = 0,
        bestD = 1e30;

      for (let i = 0; i < palLab.length; i++) {
        const pi = palLab[i];

        // L差
        const dL = L - pi.L;
        // C差
        const dC = Csrc - pi.C;
        // H差（ΔH^2 ≒ 4*C̄^2*sin^2(Δh/2)）
        const dh = deltaHue(hsrc, pi.h);
        const Cavg = 0.5 * (Csrc + pi.C);
        const dH2 = 4 * Cavg * Cavg * Math.sin(dh * 0.5) ** 2;

        let d = wL * (dL * dL) + wC * (dC * dC) + wH * dH2 + penaltyK * pi.pen;

        // 低彩度（灰/白）への過度な吸着を抑制
        if (Csrc > 0.06 && pi.C < 0.03) d += grayBias * (Csrc - pi.C);
        // “ほぼ白”(L>0.92) への不要マッピング保護（色みがあるとき）
        if (pi.L > 0.92 && Csrc > 0.05) {
          d += whiteGuardL * Math.max(0, pi.L - L) ** 2;
          d += whiteGuardC * Math.max(0, Csrc - pi.C) ** 2;
        }

        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }

      if (!isFinite(bestD)) {
        best = nearestRgbIndex(img, k, palLab); // 最終保険
      }

      const q = palLab[best];

      // 書き込み（sRGB）
      const j = k * 4;
      img.data[j] = q.r;
      img.data[j + 1] = q.g;
      img.data[j + 2] = q.b;
      img.data[j + 3] = 255;

      if (!useDither) continue;

      // 誤差（OKLab）
      let dL = L - q.L,
        dA = A - q.A,
        dB = B - q.B;

      // エッジ強抑制しすぎない（最低50%は拡散）
      if (edge) {
        let m = sigmoid((edgeT - edge[k]) / edgeSlope); // 0..1
        m = 0.5 + 0.5 * m; // 0.5..1.0
        dL *= m;
        dA *= m;
        dB *= m;
      }

      // Floyd–Steinberg（serpentine対応）
      const right = x + step,
        left = x - step;
      if (right >= 0 && right < width) {
        const t = idx(right, y);
        eL[t] += dL * (7 / 16);
        eA[t] += dA * (7 / 16);
        eB[t] += dB * (7 / 16);
      }
      if (y + 1 < height && left >= 0 && left < width) {
        const t = idx(left, y + 1);
        eL[t] += dL * (3 / 16);
        eA[t] += dA * (3 / 16);
        eB[t] += dB * (3 / 16);
      }
      if (y + 1 < height) {
        const t = idx(x, y + 1);
        eL[t] += dL * (5 / 16);
        eA[t] += dA * (5 / 16);
        eB[t] += dB * (5 / 16);
      }
      if (y + 1 < height && right >= 0 && right < width) {
        const t = idx(right, y + 1);
        eL[t] += dL * (1 / 16);
        eA[t] += dA * (1 / 16);
        eB[t] += dB * (1 / 16);
      }
    }
  }
}

/* ================= ヘルパ ================= */

function normalizeAllowSets(a) {
  return {
    wool: !!a?.wool,
    terracotta: !!a?.terracotta,
    concrete: !!a?.concrete,
    custom: !!a?.custom,
  };
}
function detectAllowedFromUI() {
  const on = (id) => !!document.getElementById(id)?.checked;
  const wool = on("pWool"),
    terr = on("pTerracotta"),
    conc = on("pConcrete"),
    cust = on("pCustom");
  if (!(wool || terr || conc || cust))
    return { wool: true, terracotta: true, concrete: true, custom: false }; // 何も触れてない→既定
  return { wool: wool, terracotta: terr, concrete: conc, custom: cust };
}
function filterPaletteByAllowedSets(palette, allow) {
  return palette.filter((p) => {
    const id = String(p[3] || "");
    const isWool = /_wool$/.test(id);
    const isTerr = /_terracotta$/.test(id) || /stained_hardened_clay/.test(id);
    const isConc = /_concrete$/.test(id);
    const isCust = !(isWool || isTerr || isConc);
    return (
      (allow.wool && isWool) ||
      (allow.terracotta && isTerr) ||
      (allow.concrete && isConc) ||
      (allow.custom && isCust)
    );
  });
}

function matPenalty(id = "") {
  const get = (k) => Number(document.getElementById(k)?.value || 100);
  const t = /_wool$/.test(id)
    ? "wool"
    : /_terracotta$/.test(id) || /stained_hardened_clay/.test(id)
      ? "terracotta"
      : /_concrete$/.test(id)
        ? "concrete"
        : "custom";
  const map = {
    wool: "wWool",
    terracotta: "wTerracotta",
    concrete: "wConcrete",
    custom: "wCustom",
  };
  const w = get(map[t] || "wCustom");
  return Math.max(0, (100 - w) / 100);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// sRGB -> OKLab（線形化は256LUTで高速化）
const _linLUT = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return t;
})();
function srgbToOklab_lut(r, g, b) {
  const R = _linLUT[r & 255],
    G = _linLUT[g & 255],
    B = _linLUT[b & 255];
  const l_ = 0.412165612 * R + 0.536275208 * G + 0.0514575653 * B;
  const m_ = 0.211859107 * R + 0.6807189584 * G + 0.107406579 * B;
  const s_ = 0.0883097947 * R + 0.2818474174 * G + 0.6302613616 * B;
  const l = Math.cbrt(l_),
    m = Math.cbrt(m_),
    s = Math.cbrt(s_);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, A, B2];
}

// OKLab -> LCh / hue差
function labToLch(L, A, B) {
  const C = Math.hypot(A, B);
  const h = Math.atan2(B, A); // [-π, π]
  return [L, C, h];
}
function deltaHue(h1, h2) {
  let d = h1 - h2;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// sRGB最近傍（保険）
function nearestRgbIndex(img, k, pal) {
  const j = k * 4,
    r = img.data[j],
    g = img.data[j + 1],
    b = img.data[j + 2];
  let best = 0,
    bestD = 1e30;
  for (let i = 0; i < pal.length; i++) {
    const dr = r - pal[i].r,
      dg = g - pal[i].g,
      db = b - pal[i].b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/* -------- Guided Filter（安全版） -------- */
function guidedFilterInplaceSafe(I, w, h, r, eps) {
  const meanI = boxMean(I, w, h, r);
  const meanII = boxMeanTimes(I, I, w, h, r);
  const varI = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = meanII[i] - meanI[i] * meanI[i];
    varI[i] = v > 0 ? v : 0;
  }
  const a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const den = varI[i] + eps;
    a[i] = den > 1e-12 ? varI[i] / den : 0;
  }
  const b = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) b[i] = meanI[i] - a[i] * meanI[i];
  const meanA = boxMean(a, w, h, r);
  const meanB = boxMean(b, w, h, r);
  for (let i = 0; i < w * h; i++) I[i] = meanA[i] * I[i] + meanB[i];
}
function guidedFollowSafe(I, P, w, h, r, eps, shrinkMax = 0.6) {
  const meanI = boxMean(I, w, h, r);
  const meanP = boxMean(P, w, h, r);
  const meanII = boxMeanTimes(I, I, w, h, r);
  const varI = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = meanII[i] - meanI[i] * meanI[i];
    varI[i] = v > 0 ? v : 0;
  }
  const meanIP = boxMeanTimes(I, P, w, h, r);
  const covIP = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) covIP[i] = meanIP[i] - meanI[i] * meanP[i];

  const a = new Float32Array(w * h),
    b = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const den = varI[i] + eps;
    a[i] = den > 1e-12 ? covIP[i] / den : 0;
    a[i] = Math.max(-shrinkMax, Math.min(shrinkMax, a[i])); // 彩度保護
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxMean(a, w, h, r);
  const meanB = boxMean(b, w, h, r);
  for (let i = 0; i < w * h; i++) P[i] = meanA[i] * I[i] + meanB[i];
}

/* -------- box mean（積分画像） -------- */
function boxMean(src, w, h, r) {
  const sat = integral(src, w, h),
    out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r),
      y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r),
        x1 = Math.min(w - 1, x + r);
      const sum = satRect(sat, w, h, x0, y0, x1, y1);
      out[y * w + x] = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
    }
  }
  return out;
}
function boxMeanTimes(a, b, w, h, r) {
  const prod = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) prod[i] = a[i] * b[i];
  return boxMean(prod, w, h, r);
}
function integral(a, w, h) {
  const sat = new Float32Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowsum = 0;
    for (let x = 1; x <= w; x++) {
      rowsum += a[(y - 1) * w + (x - 1)];
      sat[y * (w + 1) + x] = sat[(y - 1) * (w + 1) + x] + rowsum;
    }
  }
  return sat;
}
function satRect(S, w, h, x0, y0, x1, y1) {
  const A = y0 * (w + 1) + x0,
    B = y0 * (w + 1) + (x1 + 1);
  const C = (y1 + 1) * (w + 1) + x0,
    D = (y1 + 1) * (w + 1) + (x1 + 1);
  return S[D] - S[C] - S[B] + S[A];
}

/* -------- Sobel（L*） -------- */
function sobelMagnitude(L, w, h) {
  const out = new Float32Array(w * h);
  const at = (x, y) =>
    L[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  let maxv = 1e-8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        -1 * at(x - 1, y - 1) +
        1 * at(x + 1, y - 1) +
        -2 * at(x - 1, y) +
        2 * at(x + 1, y) +
        -1 * at(x - 1, y + 1) +
        1 * at(x + 1, y + 1);
      const gy =
        -1 * at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        1 * at(x + 1, y - 1) +
        1 * at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        1 * at(x + 1, y + 1);
      const v = Math.hypot(gx, gy);
      out[y * w + x] = v;
      if (v > maxv) maxv = v;
    }
  }
  const inv = 1 / maxv;
  for (let i = 0; i < out.length; i++) out[i] *= inv;
  return out;
}

/* -------- Unsharp（L*） -------- */
function unsharpL_inplace(L, w, h, amount = 0.6, radius = 1, passes = 2) {
  let blur = L.slice(0);
  for (let p = 0; p < passes; p++) blur = boxMean(blur, w, h, radius);
  for (let i = 0; i < L.length; i++) {
    let v = L[i] + amount * (L[i] - blur[i]);
    if (v < 0) v = 0;
    else if (v > 1) v = 1;
    L[i] = v;
  }
}

/* -------- Bayer fallback（0..255） -------- */
const BAYER_8x8 = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 23],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
].map((row) => row.map((v) => (v / 63) * 255));
