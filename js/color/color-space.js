// RGB -> CIE Lab 変換
export function rgbToLab([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  let x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = r * 0.0193 + g * 0.1192 + b * 0.9505;

  const refX = 0.95047,
    refY = 1.0,
    refZ = 1.08883;
  x /= refX;
  y /= refY;
  z /= refZ;

  const f = (n) => (n > 0.008856 ? Math.cbrt(n) : (903.3 * n + 16) / 116);
  const fx = f(x),
    fy = f(y),
    fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// ΔE2000
export function deltaE2000(l1, l2) {
  const [L1, a1, b1] = l1,
    [L2, a2, b2] = l2;
  const kL = 1,
    kC = 1,
    kH = 1;

  const avgLp = (L1 + L2) / 2;
  const C1 = Math.hypot(a1, b1),
    C2 = Math.hypot(a2, b2);
  const avgC = (C1 + C2) / 2;

  const G =
    0.5 *
    (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1p = a1 * (1 + G),
    a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1),
    C2p = Math.hypot(a2p, b2);
  const avgCp = (C1p + C2p) / 2;

  const h = (A, B) => (Math.atan2(B, A) * 180) / Math.PI + 360;
  const h1p = h(a1p, b1) % 360;
  const h2p = h(a2p, b2) % 360;

  let deltahp =
    Math.abs(h1p - h2p) <= 180
      ? h2p - h1p
      : h2p <= h1p
        ? h2p - h1p + 360
        : h2p - h1p - 360;

  const deltaLp = L2 - L1;
  const deltaCp = C2p - C1p;
  const deltaHp =
    2 * Math.sqrt(C1p * C2p) * Math.sin((deltahp * Math.PI) / 360);

  const avgHp =
    Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;

  const T =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * avgHp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

  const deltaTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const Rc =
    2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const Sl =
    1 +
    (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const Sc = 1 + 0.045 * avgCp;
  const Sh = 1 + 0.015 * avgCp * T;
  const Rt = -Math.sin((2 * deltaTheta * Math.PI) / 180) * Rc;

  return Math.sqrt(
    Math.pow(deltaLp / (kL * Sl), 2) +
      Math.pow(deltaCp / (kC * Sc), 2) +
      Math.pow(deltaHp / (kH * Sh), 2) +
      Rt * (deltaCp / (kC * Sc)) * (deltaHp / (kH * Sh))
  );
}

// Labキャッシュユーティリティ
export function getLabCached(rgb, labCache) {
  const key = rgb.join(",");
  let lab = labCache.get(key);
  if (!lab) {
    lab = rgbToLab(rgb);
    labCache.set(key, lab);
  }
  return lab;
}
