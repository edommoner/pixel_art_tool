// js/palettes/dynamic-categories-ui.js
// 取り込み済みカテゴリをON/OFFするUI＆永続化＆アクティブパレット計算
const LS_KEY = "pixelart.dynamicCats.v1";

// ここに「取り込み時のカテゴリ」をマージする
const CategoryStore = {
  // { catName: [ [r,g,b,"id","label"], ... ], ... }
  cats: {},
  // Map<catName, boolean>
  enabled: new Map(),
  catLabelJa: (k) => k,
};

import {
  loadSavedDynamicBlocks,
  game8CategoryJa,
  materialLabelJa,
  blockcatLabelJa,
} from "./dynamic-source-octopuchi-game8.js";
const COLOR_KEYS = new Set([
  "white",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
  "blue",
  "green",
  "brown",
  "gray",
  "black",
  "transparent",
  "other",
]);
const BLOCKCAT_KEYS = new Set([
  "stone",
  "dirt",
  "wood",
  "ore",
  "sand",
  "glass",
  "wool",
  "bricks",
  "terracotta",
  "concrete",
  "slab",
  "stairs",
  "sponge",
  "nether",
  "end",
  "prismarine",
  "coral",
  "other",
]);
const BLOCKCAT_ORDER = [
  "stone",
  "dirt",
  "wood",
  "ore",
  "sand",
  "glass",
  "wool",
  "bricks",
  "terracotta",
  "concrete",
  "slab",
  "stairs",
  "sponge",
  "nether",
  "end",
  "prismarine",
  "coral",
  "other",
];

function loadPref() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}
function savePref() {
  const pref = Object.fromEntries(CategoryStore.enabled.entries());
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(pref));
  } catch {}
}

function q(id) {
  return document.getElementById(id);
}

function renderToggles() {
  const wrap = q("dynCatToggles");
  const sum = q("dynCatSummary");
  if (!wrap) return;

  // --- カテゴリの種類を自動判定（色 or 素材）して日本語化関数を設定 ---
  const keys = Object.keys(CategoryStore.cats || {});
  const isColor = keys.length > 0 && keys.every((k) => COLOR_KEYS.has(k));
  const isBlock = keys.length > 0 && keys.every((k) => BLOCKCAT_KEYS.has(k));
  CategoryStore.catLabelJa = isColor
    ? game8CategoryJa
    : isBlock
      ? blockcatLabelJa
      : materialLabelJa;
  const orderedKeys = isBlock
    ? BLOCKCAT_ORDER.filter((k) => keys.includes(k))
    : keys;

  // 以降、既存UIの生成で label 表示を CategoryStore.catLabelJa(k) に差し替える
  // （既存のチェックボックス/行生成ロジックを流用）
  // 例:
  // const label = document.createElement("label");
  // label.textContent = CategoryStore.catLabelJa(key);
  // ※あなたの既存ロジック内の「key をそのまま表示している箇所」を置換してください

  const pref = loadPref();
  // 初期状態：未知カテゴリは既定で有効
  Object.keys(CategoryStore.cats).forEach((cat) => {
    if (!CategoryStore.enabled.has(cat)) {
      const v = pref[cat] !== undefined ? !!pref[cat] : true;
      CategoryStore.enabled.set(cat, v);
    }
  });

  // UI再描画
  wrap.innerHTML = "";
  const cats = Object.keys(CategoryStore.cats).sort();
  cats.forEach((cat) => {
    const id = `dynCat_${cat}`;
    const checked = CategoryStore.enabled.get(cat);
    const count = CategoryStore.cats[cat]?.length || 0;
    const label = `${CategoryStore.catLabelJa(cat)} (${count})`;
    const el = document.createElement("label");
    el.className = "chip toggle";
    el.innerHTML = `<input type="checkbox" id="${id}" ${checked ? "checked" : ""}> ${label}`;
    wrap.appendChild(el);

    el.querySelector("input").addEventListener("change", () => {
      CategoryStore.enabled.set(cat, el.querySelector("input").checked);
      savePref();
      announceChange();
      updateSummary();
    });
  });

  // 操作ボタン
  q("dynCatAllOn")?.addEventListener("click", () => {
    for (const k of Object.keys(CategoryStore.cats))
      CategoryStore.enabled.set(k, true);
    savePref();
    renderToggles();
    announceChange();
  });
  q("dynCatAllOff")?.addEventListener("click", () => {
    for (const k of Object.keys(CategoryStore.cats))
      CategoryStore.enabled.set(k, false);
    savePref();
    renderToggles();
    announceChange();
  });
  q("dynCatInvert")?.addEventListener("click", () => {
    for (const k of Object.keys(CategoryStore.cats)) {
      CategoryStore.enabled.set(k, !CategoryStore.enabled.get(k));
    }
    savePref();
    renderToggles();
    announceChange();
  });

  updateSummary();

  function updateSummary() {
    const onCats = Object.keys(CategoryStore.cats).filter((c) =>
      CategoryStore.enabled.get(c)
    );
    const blocks = onCats.reduce(
      (a, c) => a + (CategoryStore.cats[c]?.length || 0),
      0
    );
    if (sum)
      sum.textContent = `有効カテゴリ: ${onCats.length} / ${cats.length}、有効ブロック数: ${blocks}`;
  }
}
// 追加：完全置き換え（前の色カテゴリ等を残さない）
export function replaceDynamicCategories(cats) {
  CategoryStore.cats = cats || {};
  // 有効/無効は保存値を使いつつ未知キーはON
  const pref = loadPref();
  CategoryStore.enabled = new Map();
  for (const k of Object.keys(CategoryStore.cats)) {
    const v = typeof pref[k] === "boolean" ? pref[k] : true;
    CategoryStore.enabled.set(k, v);
  }
  savePref();
  // UI再描画（このファイル内の関数を直接呼ぶ）
  try {
    renderToggles();
  } catch {}
}

// 現在有効なカテゴリを平坦化して返す（配列）
export function getEnabledDynamicPalette() {
  const out = [];
  for (const [cat, list] of Object.entries(CategoryStore.cats)) {
    if (CategoryStore.enabled.get(cat)) out.push(...list);
  }
  return out;
}

// 取り込み直後に呼ぶ：カテゴリを追加してUI更新
export function mergeDynamicCategories(catsObj) {
  CategoryStore.cats = { ...CategoryStore.cats, ...catsObj };
  renderToggles();
  announceChange();
}

// ほかのモジュールへ“変わったよ”を知らせる
function announceChange() {
  const detail = {
    enabledCats: Object.fromEntries(CategoryStore.enabled),
    enabledPalette: getEnabledDynamicPalette(),
  };
  document.dispatchEvent(
    new CustomEvent("dynamicCategoriesChanged", { detail })
  );
}

// 初期化（index.htmlから呼ぶ）
export function initDynamicCategoryToggles() {
  // 既に取り込み済みのカテゴリが window 側にあれば取り込む（任意）
  if (window.__importedCategories) {
    CategoryStore.cats = { ...window.__importedCategories };
  }
  renderToggles();
  announceChange();
}

("./dynamic-source-octopuchi-game8.js");

// 起動時：保存済みの動的ブロックがあれば復元
(function restoreSavedDynamic() {
  const saved = loadSavedDynamicBlocks?.();
  if (!saved || !saved.cats) return;

  // 既存の CategoryStore に流し込む
  CategoryStore.cats = saved.cats;
  // 未知カテゴリはON初期化（既存UIの仕様に合わせてください）
  for (const k of Object.keys(CategoryStore.cats)) {
    if (!CategoryStore.enabled.has(k)) CategoryStore.enabled.set(k, true);
  }

  // トグルUIがカテゴリ表示名を使う場合のフォールバック
  // （ラベル表示用に必要なら適宜利用）
  CategoryStore.catLabelJa = (key) => game8CategoryJa(key);
})();
