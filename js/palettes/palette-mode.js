// js/palettes/palette-mode.js
import { getEnabledDynamicPalette } from "./dynamic-categories-ui.js";

const LS_KEY = "pixelart.paletteMode.v1"; // 'static' | 'dynamic'

function loadMode() {
  try {
    return localStorage.getItem(LS_KEY) || "static";
  } catch {
    return "static";
  }
}
function saveMode(v) {
  try {
    localStorage.setItem(LS_KEY, v);
  } catch {}
}

function showPanels(mode) {
  const s = document.getElementById("staticPalettePanel");
  const d = document.getElementById("dynamicPalettePanel");
  if (s) s.style.display = mode === "static" ? "" : "none";
  if (d) d.style.display = mode === "dynamic" ? "" : "none";
}

function recomputeActivePalette(mode) {
  // 既存の処理に“乗っかる”形にする
  if (mode === "static") {
    // 既存の「静的パレットを組み立てる」処理をそのまま呼ぶ
    if (window.buildActivePalette) {
      window.buildActivePalette(); // ← あなたの既存関数名に合わせてください
    } else if (window.state?.paletteArrayStatic) {
      // フォールバック：もし静的の配列を持っているなら差し替え
      window.state.paletteArray = window.state.paletteArrayStatic;
    }
  } else {
    // 動的：取り込みカテゴリの“有効分だけ”
    const dyn = getEnabledDynamicPalette(); // [[r,g,b,"id","label"], ...]
    if (window.buildActivePalette) {
      // 既存の関数に差し込めるなら動的を渡す
      try {
        window.buildActivePalette({
          dynamicAppend: dyn,
          replaceWithDynamic: true,
        });
      } catch {
        window.state && (window.state.paletteArray = dyn);
      }
    } else if (window.state) {
      window.state.paletteArray = dyn;
    }
  }
  // 既存の再描画フックがあれば呼ぶ（なければ CustomEvent を投げる）
  if (typeof window.refreshPreview === "function") window.refreshPreview();
  document.dispatchEvent(
    new CustomEvent("paletteChanged", { detail: { mode } })
  );
}

export function initPaletteModeSwitch() {
  const modeStatic = document.getElementById("modeStatic");
  const modeDynamic = document.getElementById("modeDynamic");

  // 復元
  const cur = loadMode();
  if (modeStatic) modeStatic.checked = cur === "static";
  if (modeDynamic) modeDynamic.checked = cur === "dynamic";
  showPanels(cur);
  recomputeActivePalette(cur);

  const onChange = () => {
    const next = modeDynamic?.checked ? "dynamic" : "static";
    saveMode(next);
    showPanels(next);
    recomputeActivePalette(next);
  };

  modeStatic?.addEventListener("change", onChange);
  modeDynamic?.addEventListener("change", onChange);

  // 動的カテゴリが変わったら、動的モードのときだけ再計算
  document.addEventListener("dynamicCategoriesChanged", (e) => {
    if (modeDynamic?.checked) recomputeActivePalette("dynamic");
  });
}
