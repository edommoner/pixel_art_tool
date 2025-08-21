import { PALETTES } from "../constants.js";
import { rgbToLab, deltaE2000, getLabCached } from "./color-space.js";
import { getEnabledDynamicPalette } from "../palettes/dynamic-categories-ui.js";

// アクティブパレットの組み立て（UIチェック＆カスタム反映）+ Labキャッシュ更新
export function assembleActivePalette(state) {
  const arr = [];
  state.groupOfId.clear();

  // パレットモードの判定（静的/動的）
  const useDynamic = !!document.getElementById("modeDynamic")?.checked;

  if (useDynamic) {
    // 取り込みカテゴリのうち「有効」だけを使って activePalette を構築
    const dyn = getEnabledDynamicPalette(); // [[r,g,b,"id","label"], ...]
    for (const item of dyn) {
      const id = item[3];
      // 動的パレット由来であることをグループに記録（重みは未設定→1）
      state.groupOfId.set(id, "dynamic");
      arr.push(item);
    }
    state.activePalette = arr;
    // Lab キャッシュ更新
    state.paletteLab = state.activePalette.map(([r, g, b]) =>
      rgbToLab([r, g, b])
    );
    state.labCache.clear();
    return; // 動的モードはここで完了（静的は下の処理へ）
  }

  const pWool = document.getElementById("pWool")?.checked ?? true;
  const pTerr = document.getElementById("pTerracotta")?.checked ?? false;
  const pConc = document.getElementById("pConcrete")?.checked ?? false;

  const pMapNature = document.getElementById("pMapNature")?.checked ?? false;
  const pMapWood = document.getElementById("pMapWood")?.checked ?? false;
  const pMapMinerals = document.getElementById("pMapMinerals")?.checked ?? false;
  const pMapBuilding = document.getElementById("pMapBuilding")?.checked ?? false;
  const pMapLiquidsFire = document.getElementById("pMapLiquidsFire")?.checked ?? false;
  const pMapNether = document.getElementById("pMapNether")?.checked ?? false;
  const pMapEnd = document.getElementById("pMapEnd")?.checked ?? false;

  const pCust = document.getElementById("pCustom")?.checked ?? false;

  const pushUnique = (item, group) => {
    const id = item[3];
    state.groupOfId.set(id, group);
    if (!arr.some((x) => x[3] === id)) arr.push(item);
  };

  if (pWool) PALETTES.wool.forEach((it) => pushUnique(it, "wool"));
  if (pTerr) PALETTES.terracotta.forEach((it) => pushUnique(it, "terracotta"));
  if (pConc) PALETTES.concrete.forEach((it) => pushUnique(it, "concrete"));

  if (pMapNature && PALETTES.map_nature) PALETTES.map_nature.forEach((it) => pushUnique(it, "map_nature"));
  if (pMapWood && PALETTES.map_wood) PALETTES.map_wood.forEach((it) => pushUnique(it, "map_wood"));
  if (pMapMinerals && PALETTES.map_minerals) PALETTES.map_minerals.forEach((it) => pushUnique(it, "map_minerals"));
  if (pMapBuilding && PALETTES.map_building) PALETTES.map_building.forEach((it) => pushUnique(it, "map_building"));
  if (pMapLiquidsFire && PALETTES.map_liquids_fire) PALETTES.map_liquids_fire.forEach((it) => pushUnique(it, "map_liquids_fire"));
  if (pMapNether && PALETTES.map_nether) PALETTES.map_nether.forEach((it) => pushUnique(it, "map_nether"));
  if (pMapEnd && PALETTES.map_end) PALETTES.map_end.forEach((it) => pushUnique(it, "map_end"));

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
