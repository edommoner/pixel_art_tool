import { PALETTES } from "../constants.js";
import { rgbToLab, deltaE2000, getLabCached } from "./color-space.js";

// アクティブパレットの組み立て（UIチェック＆カスタム反映）+ Labキャッシュ更新
export function assembleActivePalette(state) {
  const arr = [];
  state.groupOfId.clear();

  const pWool = document.getElementById("pWool")?.checked ?? true;
  const pTerr = document.getElementById("pTerracotta")?.checked ?? false;
  const pConc = document.getElementById("pConcrete")?.checked ?? false;
  const pCust = document.getElementById("pCustom")?.checked ?? false;

  const pushUnique = (item, group) => {
    const id = item[3];
    state.groupOfId.set(id, group);
    if (!arr.some((x) => x[3] === id)) arr.push(item);
  };

  if (pWool) PALETTES.wool.forEach((it) => pushUnique(it, "wool"));
  if (pTerr) PALETTES.terracotta.forEach((it) => pushUnique(it, "terracotta"));
  if (pConc) PALETTES.concrete.forEach((it) => pushUnique(it, "concrete"));
  if (pCust && state.customPalette?.length)
    state.customPalette.forEach((it) => pushUnique(it, "custom"));
  if (arr.length === 0) PALETTES.wool.forEach((it) => pushUnique(it, "wool")); // 最低限wool

  state.activePalette = arr;
  state.paletteLab = state.activePalette.map(([r, g, b]) =>
    rgbToLab([r, g, b])
  );
  state.labCache.clear();
}

// 内部: 有効距離（除外/重み・グループ重み反映）
function effectiveDistance(rgb, idx, state) {
  const item = state.activePalette[idx];
  const id = item[3];
  const pref = state.blockPrefs[id];
  if (pref && pref.enabled === false) return Infinity;

  const lab1 = getLabCached(rgb, state.labCache);
  const d = deltaE2000(lab1, state.paletteLab[idx]);

  const group = state.groupOfId.get(id);
  const gw = state.groupWeights[group] ?? 1;
  const w = (pref && pref.weight > 0 ? pref.weight : 1) * (gw > 0 ? gw : 1);

  return d / w;
}

// 最近傍色検索
export function findNearestColorRGB(rgb, state) {
  let bestIdx = 0,
    best = Infinity;
  for (let i = 0; i < state.activePalette.length; i++) {
    const e = effectiveDistance(rgb, i, state);
    if (e < best) {
      best = e;
      bestIdx = i;
    }
  }
  const p = state.activePalette[bestIdx];
  return { rgb: p.slice(0, 3), blockId: p[3], label: p[4] };
}
