import JSZip from "jszip";
import { saveAs } from "file-saver";
import { drawGridOverlay } from "../render/grid.js";
import { computeScale } from "../render/preview.js";
import { els } from "../ui/elements.js";

// ---- Auto background helpers (block-based) ----
function srgbToLinear(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function relLuminance([r, g, b]) {
  const R = srgbToLinear(r),
    G = srgbToLinear(g),
    B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrastRatioRGB([r1, g1, b1], [r2, g2, b2]) {
  const L1 = relLuminance([r1, g1, b1]),
    L2 = relLuminance([r2, g2, b2]);
  const Lmax = Math.max(L1, L2),
    Lmin = Math.min(L1, L2);
  return (Lmax + 0.05) / (Lmin + 0.05);
}
function pickAutoBg(rgb) {
  const white = [255, 255, 255],
    black = [17, 17, 17],
    light = [245, 245, 245],
    dark = [32, 32, 32];
  if (!rgb || !Number.isFinite(rgb[0])) return light;
  const cW = contrastRatioRGB(rgb, white),
    cB = contrastRatioRGB(rgb, black);
  let best = cW >= cB ? white : black,
    bestC = Math.max(cW, cB);
  if (bestC < 3.0) {
    const L = relLuminance(rgb);
    const alt = L < 0.5 ? light : dark;
    if (contrastRatioRGB(rgb, alt) > bestC) best = alt;
  }
  return best;
}

export async function exportPerBlockLayersZip(state) {
  const size = els.resultCanvas.width;
  if (!size) {
    alert("先に画像を変換してください。");
    return;
  }

  const ctx = els.resultCanvas.getContext("2d");
  const img = ctx.getImageData(0, 0, size, size);

  // ★ 出力は必ずスナップショットから読む（なければ従来どおり）
  let data;
  if (
    state.finalImageData &&
    state.finalImageData.width === size &&
    state.finalImageData.height === size
  ) {
    data = state.finalImageData.data;
  } else {
    const img = ctx.getImageData(0, 0, size, size);
    data = img.data;
  }

  // ★ DEBUG 比較：量子化直後から色が変わっていないか
  if (
    state.debugImageData &&
    state.debugImageData.width === img.width &&
    state.debugImageData.height === img.height
  ) {
    let diffCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (
        data[i] !== state.debugImageData.data[i] ||
        data[i + 1] !== state.debugImageData.data[i + 1] ||
        data[i + 2] !== state.debugImageData.data[i + 2]
      ) {
        diffCount++;
        if (diffCount <= 20) {
          const px = (i / 4) % size,
            py = Math.floor(i / 4 / size);
          console.log("[DEBUG diff]", {
            x: px,
            y: py,
            now: [data[i], data[i + 1], data[i + 2]],
            was: [
              state.debugImageData.data[i],
              state.debugImageData.data[i + 1],
              state.debugImageData.data[i + 2],
            ],
          });
        }
      }
    }
    console.log(
      "[DEBUG] changed pixels after quantization:",
      diffCount,
      "of",
      data.length / 4
    );
  } else {
    console.log(
      "[DEBUG] no baseline to compare (state.debugImageData missing or size mismatch)"
    );
  }

  // ★ 量子化時に固定した配列があればそれを優先
  const palette =
    state.paletteSnapshot && state.paletteSnapshot.length
      ? state.paletteSnapshot
      : state.activePalette;

  // ★ DEBUG: ここで初期化
  let zipUnmatched = 0;

  // 出現ブロック抽出
  const used = new Map(); // id -> { rgb, label, count }
  for (let i = 0; i < data.length; i += 4) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    const p = palette.find(([r, g, b]) => `${r},${g},${b}` === key);
    if (!p) {
      zipUnmatched++; // ★ DEBUG: パレットに無い色をカウント
      continue;
    }
    const [r, g, b, id, label] = p;
    const e = used.get(id) || { rgb: [r, g, b], label, count: 0 };
    e.count++;
    used.set(id, e);
  }
  if (used.size === 0) {
    alert("使用ブロックが見つかりませんでした。");
    return;
  }
  // ★ DEBUG: 結果表示
  console.log(
    "layers-zip unmatched:",
    zipUnmatched,
    "palette size:",
    palette.length
  );
  console.log("total pixels:", data.length / 4);
  // 並べ替え
  let items = Array.from(used.entries());
  if (els.sortLayersByCount?.checked) {
    items.sort((a, b) => b[1].count - a[1].count);
  } else {
    const order = new Map(state.activePalette.map((p, i) => [p[3], i]));
    items.sort((a, b) => (order.get(a[0]) ?? 1e9) - (order.get(b[0]) ?? 1e9));
  }

  // 背景設定
  const bgMode = els.layerBg?.value || "transparent";
  const dimRGB = [220, 220, 220];
  let customRGB = [221, 221, 221];
  if (bgMode === "color") {
    const hex = (els.layerBgColor?.value || "#DDDDDD").replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16),
      g = parseInt(hex.substring(2, 4), 16),
      b = parseInt(hex.substring(4, 6), 16);
    customRGB = [r, g, b];
  }

  const zip = new JSZip();
  const scale = computeScale(size);

  for (let sIdx = 0; sIdx < items.length; sIdx++) {
    const [id, info] = items[sIdx];
    // 代表色（＝このレイヤーのブロック色）
    // 代表色（このレイヤーのブロック色）
    const [tr, tg, tb] = info.rgb || [127, 127, 127];

    // 1) Canvas/context を先に作る
    const base = document.createElement("canvas");
    base.width = base.height = size;
    const bctx = base.getContext("2d", { willReadFrequently: true });

    // 2) レイヤー単位の自動背景を決める
    const autoRGB = bgMode === "auto" ? pickAutoBg([tr, tg, tb]) : null;

    // 3) 画像データを丸ごと組み立てる（背景もここで塗る）
    const layer = bctx.createImageData
      ? bctx.createImageData(size, size)
      : new ImageData(size, size);
    const out = layer.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const match = r === tr && g === tg && b === tb;

      if (match) {
        // 対象ブロックのピクセル
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
        out[i + 3] = 255;
      } else if (bgMode === "dim") {
        out[i] = 220;
        out[i + 1] = 220;
        out[i + 2] = 220;
        out[i + 3] = 255;
      } else if (bgMode === "color") {
        out[i] = customRGB[0];
        out[i + 1] = customRGB[1];
        out[i + 2] = customRGB[2];
        out[i + 3] = 255;
      } else if (bgMode === "auto") {
        out[i] = autoRGB[0];
        out[i + 1] = autoRGB[1];
        out[i + 2] = autoRGB[2];
        out[i + 3] = 255; // ★不透明で塗る
      } else {
        // transparent モード
        out[i + 3] = 0;
      }
    }

    bctx.putImageData(layer, 0, 0);

    // 拡大＋グリッド
    const outCnv = document.createElement("canvas");
    outCnv.width = outCnv.height = size * scale;
    const outCtx = outCnv.getContext("2d");
    outCtx.imageSmoothingEnabled = false;
    outCtx.drawImage(base, 0, 0, outCnv.width, outCnv.height);
    drawGridOverlay(outCtx, scale, size);

    // ファイル名（日本語/連番）
    const displayName =
      info.label && info.label.trim() ? info.label.trim() : id;
    const safeJp = displayName.replace(/[\\/:*?"<>|]/g, "_");
    const name = `layer_${String(sIdx + 1).padStart(2, "0")}_${safeJp}.png`;

    const dataURL = outCnv.toDataURL("image/png");
    const bin = atob(dataURL.split(",")[1]);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    zip.file(name, u8, { binary: true });
  }

  // ---- 追加出力：足場レイヤー（ブロック種類で分割しない） ----
  // グリッドの「内側１マス」判定（majorEvery スライダー準拠）
  const majorEveryEl = document.getElementById("majorEvery");
  const N = Math.max(2, parseInt(majorEveryEl?.value || "16", 10));
  // 各セル境界の内側1マス（セルの0列/行とN-1列/行）
  const isInner1 = (x, y) => {
    const mx = x % N,
      my = y % N;
    return mx === 0 || mx === N - 1 || my === 0 || my === N - 1;
  };

  // 背景色の決定（既存設定を流用）
  const bgRGBA_for = (r, g, b, a255) => {
    if (bgMode === "dim") return [220, 220, 220, 255];
    if (bgMode === "color")
      return [customRGB[0], customRGB[1], customRGB[2], 255];
    if (bgMode === "auto") {
      const [ar, ag, ab] = pickAutoBg([r, g, b]);
      return [ar, ag, ab, 255];
    }
    // transparent
    return [0, 0, 0, 0];
  };

  const makeScaffoldLayer = (mode /* 'assemble' | 'fill' */) => {
    // 1) 出力用 ImageData を用意
    const cnv = document.createElement("canvas");
    cnv.width = cnv.height = size;
    const cctx = cnv.getContext("2d", { willReadFrequently: true });
    const outImg = cctx.createImageData
      ? cctx.createImageData(size, size)
      : new ImageData(size, size);
    const out = outImg.data;

    // 代表色（自動背景用の参照に、最頻色もしくは先頭色を使う）
    let refRGB = [127, 127, 127];
    if (items.length > 0) {
      const first = items[0][1]?.rgb;
      if (first && first.length === 3) refRGB = first;
    }

    // 2) ピクセル単位で組み立て（元画像 data を参照）
    for (let y = 0, i = 0; y < size; y++) {
      for (let x = 0; x < size; x++, i += 4) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2],
          a = data[i + 3];
        const ring = isInner1(x, y);

        const keepOriginal = mode === "assemble" ? ring : !ring;
        if (keepOriginal) {
          out[i] = r;
          out[i + 1] = g;
          out[i + 2] = b;
          out[i + 3] = 255;
        } else {
          const [br, bg, bb, ba] = bgRGBA_for(
            refRGB[0],
            refRGB[1],
            refRGB[2],
            255
          );
          out[i] = br;
          out[i + 1] = bg;
          out[i + 2] = bb;
          out[i + 3] = ba;
        }
      }
    }

    // 3) ベースに描いて拡大＋グリッドオーバーレイ
    cctx.putImageData(outImg, 0, 0);
    const outCnv = document.createElement("canvas");
    outCnv.width = outCnv.height = size * scale;
    const outCtx = outCnv.getContext("2d");
    outCtx.imageSmoothingEnabled = false;
    outCtx.drawImage(cnv, 0, 0, outCnv.width, outCnv.height);
    drawGridOverlay(outCtx, scale, size);

    const filename =
      mode === "assemble"
        ? "layer_scaffold_assemble.png"
        : "layer_scaffold_fill.png";
    const dataURL = outCnv.toDataURL("image/png");
    const bin = atob(dataURL.split(",")[1]);
    const u8 = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    zip.file(filename, u8, { binary: true });
  };

  // 生成（順番はレイヤー末尾に追加）
  try {
    makeScaffoldLayer("assemble");
  } catch (e) {
    console.warn("[scaffold assemble] failed", e);
  }
  try {
    makeScaffoldLayer("fill");
  } catch (e) {
    console.warn("[scaffold fill] failed", e);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, "mapart_layers.zip");
}
