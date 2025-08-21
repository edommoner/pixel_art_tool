// CSSをJSから読み込み（singlefileでインライン化）
import "../css/style.css";
import "cropperjs/dist/cropper.css";

import { generatePaletteFromVanillaZip } from "./palettes/generate-from-pack.js";
import {
  replaceDynamicCategories as setDynCats,
  getEnabledDynamicPalette,
} from "./palettes/dynamic-categories-ui.js";

import { initElements, els } from "./ui/elements.js";
import { state } from "./state.js";
import { loadAll, loadTabOrder, saveTabOrder } from "./storage.js";

// 雛形（後で実装差し替え）
import { assembleActivePalette } from "./color/palette.js";
import { reinitCropper } from "./cropper.js";
import { renderPreviewFrom, rerenderIfReady } from "./render/preview.js";
import { quantizeImageData, ditherImageData } from "./dither/apply-dither.js";
import { convertWithOklabGuidedDitherV2 } from "./dither/oklab-guided-natural.js";
import { updateCountsTable } from "./counts.js";
import { exportCountsCsv } from "./counts.js";
import { exportPerBlockLayersZip } from "./export/layers-zip.js";
import { exportStructureNbt } from "./export/nbt-structure.js";
import {
  openPaletteEditor,
  addPaletteRow,
  applyPalette,
  openPrefDialog,
  applyPrefs,
} from "./ui/dialogs.js";
import { runTests } from "./test.js";
import { exportMcstructure } from "./export/mcstructure.js";
import { exportDebugMcstructure } from "./export/mcstructure.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { initVanillaLinks } from "./external/vanilla-links.js";
import { initBedrockLinks } from "./external/bedrock-links.js";
import { initPersistence } from "./utils/persist.js";

import {
  clearDynamicBlocksOnce,
  applyOctopuchiGame8Filter,
  regroupCatsByGame8BlockCategory,
  regroupCatsByMaterial,
  overrideSavedDynamicBlocks,
} from "./palettes/dynamic-source-octopuchi-game8.js";

const p = initPersistence(document);
// 現在ロード済みの元画像要素を保持
let srcImageEl = null;

// --- Boot ---
initElements();
loadAll(state); // localStorage → state
assembleActivePalette(state); // いまはNO-OP（雛形）

setupTabs();
setupEvents();
initPersistence(document);
initVanillaLinks();
initBedrockLinks();
updateButtonsDisabled(true);
updateDitherUI();

function onImageLoaded(e) {
  srcImageEl = e.target; // ← グローバルに保持
  updateDitherUI(); // ここで初めて安全に呼べる
}

function setupTabs() {
  const tabsNav = document.getElementById("tabs");
  if (!tabsNav) return;

  const saved = loadTabOrder();
  if (saved && saved.length) {
    const map = {};
    [...tabsNav.children].forEach((b) => (map[b.dataset.tab] = b));
    saved.forEach((k) => map[k] && tabsNav.appendChild(map[k]));
  }

  tabsNav.addEventListener("click", (e) => {
    if (!e.target.classList.contains("tab-btn")) return;
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    e.target.classList.add("active");
    document.getElementById(e.target.dataset.tab)?.classList.add("active");
    if (e.target.dataset.tab === "tab1" && !state.cropper && els.preview?.src) {
      reinitCropper(state);
    }
    persistOrder();
  });

  let dragSrc = null;
  tabsNav.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("dragstart", (ev) => {
      dragSrc = btn;
      ev.dataTransfer.effectAllowed = "move";
    });
    btn.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      btn.classList.add("drag-over");
    });
    btn.addEventListener("dragleave", () => btn.classList.remove("drag-over"));
    btn.addEventListener("drop", (ev) => {
      ev.preventDefault();
      btn.classList.remove("drag-over");
      if (dragSrc && dragSrc !== btn) {
        const list = [...tabsNav.children];
        list.indexOf(dragSrc) < list.indexOf(btn)
          ? btn.after(dragSrc)
          : btn.before(dragSrc);
        persistOrder();
      }
    });
  });

  function persistOrder() {
    const order = [...tabsNav.children].map((b) => b.dataset.tab);
    saveTabOrder(order);
  }
}

function setupEvents() {
  if (!els.imageInput) return;

  els.imageInput.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      els.preview.onload = () => {
        reinitCropper(state);
        els.cropButton.disabled = false;
        els.downloadButton.disabled = true;
      };
      els.preview.src = r.result;
      els.preview.style.display = "block";
    };
    r.readAsDataURL(f);
  });

  els.cropButton?.addEventListener("click", () => {
    const size = parseInt(els.outputSize.value, 10);
    const ctx = els.resultCanvas.getContext("2d");
    els.resultCanvas.width = els.resultCanvas.height = size;

    // ここではcropper/量子化は未実装（後段で移植）。プレビューだけ出しておく
    const cropped = state.cropper?.getCroppedCanvas({
      width: size,
      height: size,
      imageSmoothingEnabled: false,
    });
    if (cropped) {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(cropped, 0, 0);
      const img = ctx.getImageData(0, 0, size, size);
      const useDither = !!document.getElementById("dithering")?.checked;
      const method =
        document.getElementById("ditheringMethod")?.value || "floyd";
      const useOklab = !!document.getElementById("useOklab")?.checked;

      // ★ 量子化に使うパレットを最新化し、その配列を固定保存
      assembleActivePalette(state);
      state.paletteSnapshot = state.activePalette.map((p) => [...p]);
      if (useOklab) {
        // 高品質（OKLab + Guided + 選択的ブルーノイズFS）
        convertWithOklabGuidedDitherV2(img, size, state, {
          allow: {
            wool: !!document.getElementById("pWool")?.checked,
            terracotta: !!document.getElementById("pTerracotta")?.checked,
            concrete: !!document.getElementById("pConcrete")?.checked,
            custom: !!document.getElementById("pCustom")?.checked,
          },
          useDither: useDither,
          edgeAware: !!document.getElementById("selectiveDithering")?.checked,
          natural: !!document.getElementById("naturalDithering")?.checked,
          naturalStrength:
            ((+document.getElementById("naturalStrength")?.value || 100) /
              100) *
            0.05,
          preSmooth: true, // Guided Filter 有効
          r: 2, // 半径（2〜4あたりを好みに）
          eps: 1e-3, // エッジ保持の強さ
        });
      } else {
        // 従来の処理系
        if (useDither) ditherImageData(img, size, method, state);
        else quantizeImageData(img, size, state);
      }

      // ★ 固定スナップショットを保存（後の出力は必ずこれを参照）
      state.finalImageData = new ImageData(
        new Uint8ClampedArray(img.data),
        img.width,
        img.height
      );

      // （任意：オフスクリーンにも保持しておくと安心）
      const off = document.createElement("canvas");
      off.width = img.width;
      off.height = img.height;
      off.getContext("2d").putImageData(state.finalImageData, 0, 0);
      state.finalCanvas = off;

      // ★ DEBUG 保存：量子化直後のピクセルを保持（後で比較）
      state.debugImageData = new ImageData(
        new Uint8ClampedArray(img.data),
        img.width,
        img.height
      );

      // 反映
      els.resultCanvas.getContext("2d").putImageData(img, 0, 0);
      renderPreviewFrom(els.resultCanvas, size, state);

      // ★ 即席デバッグ開始
      const keyToIndex = new Map();
      const palette =
        state.paletteSnapshot && state.paletteSnapshot.length
          ? state.paletteSnapshot
          : state.activePalette;
      palette.forEach((p, i) => keyToIndex.set(`${p[0]},${p[1]},${p[2]}`, i));

      let missAlpha = 0,
        missMap = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        const a = img.data[i + 3];
        if (a !== 255) missAlpha++;
        const key = `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`;
        if (!keyToIndex.has(key)) missMap++;
      }
      console.log("non-opaque pixels:", missAlpha, "unmapped rgb:", missMap);
      // ★ 即席デバッグ終了

      ctx.putImageData(img, 0, 0);
      updateCountsTable(img, state);
      renderPreviewFrom(els.resultCanvas, size, state);
      updateButtonsDisabled(false);
    }
  });

  // 原寸PNG
  els.downloadOrigBtn?.addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = "converted_original.png";
    a.href = els.resultCanvas.toDataURL("image/png");
    a.click();
  });
  // 拡大PNG（ガイドと同じサイズ／ガイド無し）
  els.downloadScaledBtn?.addEventListener("click", () => {
    const disp = els.displayCanvas;
    const src = els.resultCanvas;
    if (!disp || !src) return;
    const out = document.createElement("canvas");
    out.width = disp.width;
    out.height = disp.height;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = false; // ドット保持
    ctx.drawImage(src, 0, 0, out.width, out.height);
    const a = document.createElement("a");
    a.download = "converted_scaled.png";
    a.href = out.toDataURL("image/png");
    a.click();
  });

  // ガイド画像を保存（displayCanvasを書き出し）
  document.getElementById("downloadGuideBtn")?.addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = "guide.png";
    a.href = els.displayCanvas.toDataURL("image/png");
    a.click();
  });

  document
    .getElementById("exportCountsBtn")
    ?.addEventListener("click", exportCountsCsv);

  let maskVisible = true;
  document.getElementById("toggleMaskBtn")?.addEventListener("click", () => {
    maskVisible = !maskVisible;
    els.maskCanvas.style.display = maskVisible ? "block" : "none";
  });

  // CSV
  document
    .getElementById("exportCountsBtn")
    ?.addEventListener("click", exportCountsCsv);

  // --- Export: レイヤーZIP（ボタンが存在する場合のみ）
  document
    .getElementById("exportPerBlockZip")
    ?.addEventListener("click", () => {
      exportPerBlockLayersZip(state);
    });

  // --- Dialogs: カスタムパレット ---
  els.editPaletteBtn?.addEventListener("click", () => {
    assembleActivePalette(state); // 最新のアクティブ内容反映（色プレビュー用）
    openPaletteEditor(state);
  });
  els.addColorBtn?.addEventListener("click", () => {
    addPaletteRow(0, 0, 0, "minecraft:black_wool", "");
  });
  els.applyPaletteBtn?.addEventListener("click", () => {
    applyPalette(state);
  });

  // --- Dialogs: 除外 / 重み ---
  els.prefBtn?.addEventListener("click", () => {
    assembleActivePalette(state); // テーブルのベースに現行パレットを使う
    openPrefDialog(state);
  });
  els.applyPrefBtn?.addEventListener("click", () => {
    applyPrefs(state);
  });

  // --- Dev: テスト実行 ---
  els.runTestsBtn?.addEventListener("click", () => {
    runTests(state);
  });

  // === ガイド・グリッド関連を “input” で即反映 ===
  [
    "showOutline", // ガイド：境界線
    "showSymbols", // ガイド：数字
    "symbolScale", // 記号サイズ
    "gridTheme", // グリッド配色
    "thinWidth", // 細グリッド太さ
    "majorWidth", // 強調グリッド太さ
    "majorEvery", // 強調間隔
    "gridAutoPerCell", // ますごと描画
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = () => {
      // 強調間隔の数値表示を連動更新（存在すれば）
      if (id === "majorEvery") {
        const span = document.getElementById("majorEveryVal");
        if (span) span.textContent = el.value;
      }
      // いまの結果キャンバスから即再描画
      rerenderIfReady(state);
    };
    // “input” で即反映、フォールバックに “change” も一応
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });
  document.getElementById("exportNbtBtn")?.addEventListener("click", () => {
    exportStructureNbt(state);
  });
  // === ブロックグループ（羊毛/テラコッタ/コンクリート/カスタム） ===
  ["pWool", "pTerracotta", "pConcrete", "pCustom"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      assembleActivePalette(state); // 有効なパレットを更新
      rerenderIfReady(state); // ガイド・凡例を即再描画
      // 既存の結果画像は前パレットで量子化済みなので、
      // 色の再マッピングは行いません（次回の変換に適用）
    });
  });

  document
    .getElementById("exportMcstructureBtn")
    ?.addEventListener("click", () => {
      exportMcstructure(state);
    });

  document.getElementById("resetSettingsBtn")?.addEventListener("click", () => {
    p.clear();
    location.reload();
  });

  document
    .getElementById("importVanillaZip")
    ?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const status = document.getElementById("importStatus");
      status.textContent = "解析中…";
      try {
        clearDynamicBlocksOnce();
        const skip = document.getElementById("skipBiomeTint")?.checked ?? true;
        const { categories } = await generatePaletteFromVanillaZip(file, {
          skipBiomeTint: skip,
        });
        // ── 取り込んだ categories をフラット化して動的リストへ
        // 期待形: categories = { anyKey: [ [r,g,b,"id","label"], ... ], ... }
        const dynamicList = [];
        for (const arr of Object.values(categories)) {
          for (const it of arr) {
            // 安全側に5要素想定
            const [r, g, b, id, label] = it;
            dynamicList.push({
              rgb: [r, g, b],
              id,
              label,
            });
          }
        }

        const { cats } = applyOctopuchiGame8Filter(dynamicList); // 色カテゴリで一次取得
        const catsByBlock = regroupCatsByGame8BlockCategory(cats); // 木材/石/…
        setDynCats(catsByBlock); // ★ 置き換え登録（混在を防止）
        overrideSavedDynamicBlocks(catsByBlock); // ★ 保存もブロック種別で上書き

        // （重要）アクティブパレットを更新 → 変換を再実行
        const dyn = getEnabledDynamicPalette();
        // 既存のビルド関数があるならそこへ dyn を合流させる
        if (window.buildActivePalette) {
          window.buildActivePalette({ dynamicAppend: dyn }); // 例：あなたの関数に合流
        }
        // なければ、最小限：state.paletteArray を差し替えて再描画
        if (window.state) {
          window.state.paletteArray = dyn;
          document.dispatchEvent(new CustomEvent("paletteChanged")); // 任意のフック
        }
        const filteredCount = Object.values(cats).reduce(
          (a, b) => a + b.length,
          0
        );
        const count = Object.values(regroupCatsByMaterial).reduce(
          (a, b) => a + b.length,
          0
        );
        const count2 = Object.values(catsByBlock).reduce(
          (a, b) => a + b.length,
          0
        );
        status.textContent = `完了：${count2} ブロック（ブロック種別で登録）`;
      } catch (err) {
        console.error(err);
        status.textContent = "失敗しました（コンソール参照）";
      }
    });
}

function updateButtonsDisabled(disabled) {
  // ダウンロード系
  if (els.downloadOrigBtn) els.downloadOrigBtn.disabled = disabled;
  if (els.downloadScaledBtn) els.downloadScaledBtn.disabled = disabled;
  if (els.exportCountsBtn) els.exportCountsBtn.disabled = disabled;
  // エクスポート系は次段で有効化
  [
    "downloadGuideBtn",
    "exportPerBlockZip",
    "exportNbtBtn",
    "exportMcstructureBtn",
  ].forEach((id) => {
    const x = document.getElementById(id);
    if (x) x.disabled = disabled;
  });
}

function updateDitherUI() {
  const img = srcImageEl || document.getElementById("srcImage"); // 後方互換の保険
  if (!img) return; // 画像がまだ無い状態では何もしない

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const on = !!document.getElementById("dithering")?.checked;
  const nat = !!document.getElementById("naturalDithering")?.checked;
  const useOklab = !!document.getElementById("useOklab")?.checked;

  assembleActivePalette(state);
  state.paletteSnapshot = state.activePalette.map((p) => [
    +p[0] | 0,
    +p[1] | 0,
    +p[2] | 0,
    p[3],
    p[4],
  ]);

  if (useOklab) {
    convertWithOklabGuidedDitherV2(img, size, state, {
      useDither: !!document.getElementById("dithering")?.checked,
      edgeAware: !!document.getElementById("selectiveDithering")?.checked,
      natural: !!document.getElementById("naturalDithering")?.checked,
      naturalStrength:
        ((+document.getElementById("naturalStrength")?.value || 100) / 100) *
        0.035,
      preSmooth: true, // まず true で試して、重ければ false へ
      r: 1,
      eps: 5e-3,
    });
  } else {
    // 既存の処理
    if (useDither) ditherImageData(img, size, method, state);
    else quantizeImageData(img, size, state);
  }

  ["ditheringMethod", "selectiveDithering", "naturalDithering"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      // 「手法」は OKLab 使用時に無効。それ以外は従来通り on で有効
      if (id === "ditheringMethod") {
        el.disabled = !on || useO;
      } else {
        el.disabled = !on;
      }
    }
  );

  const strength = document.getElementById("naturalStrength");
  const lblStrength = strength?.parentElement;
  if (strength) strength.disabled = !(on && nat);
  if (lblStrength)
    lblStrength.style.display = on && nat ? "inline-flex" : "none";
}

// 変更イベントに useOklab を追加して即時反映
["dithering", "naturalDithering", "useOklab"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", updateDitherUI);
});

window.addEventListener("DOMContentLoaded", initBedrockLinks, { once: true });
