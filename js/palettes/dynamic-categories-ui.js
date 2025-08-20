// js/palettes/dynamic-categories-ui.js
// 取り込み済みカテゴリをON/OFFするUI＆永続化＆アクティブパレット計算
const LS_KEY = "pixelart.dynamicCats.v1";

// ここに「取り込み時のカテゴリ」をマージする
const CategoryStore = {
  // { catName: [ [r,g,b,"id","label"], ... ], ... }
  cats: {},
  // Map<catName, boolean>
  enabled: new Map(),
};

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
    const label = `${cat} (${count})`;
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
