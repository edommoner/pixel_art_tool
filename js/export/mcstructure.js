// tool/js/export/mcstructure.js
import { els } from "../ui/elements.js";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { NbtWriterBE } from "../nbt/writer.js";

const MAX_XZ = 64;
const BLOCK_VERSION = 18168865;

// 回転：右回転（時計回り）90°固定
const ROTATE_DEG = 90;

// 回転後の出力座標系で水平反転する場合は true（必要なければ false）
const FLIP_X = true;

// -------------------------------------------------------------
// Color & naming utils
// -------------------------------------------------------------
const COLORS = [
  "white",
  "orange",
  "magenta",
  "light_blue",
  "yellow",
  "lime",
  "pink",
  "gray",
  "light_gray",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black",
];

function normColorToken(s) {
  const t = (s || "")
    .toLowerCase()
    .replace("lightgrey", "light_gray")
    .replace("lightgray", "light_gray")
    .replace("lightblue", "light_blue")
    .replace("grey", "gray")
    .replace("silver", "light_gray");
  return COLORS.includes(t) ? t : t;
}

function ensureNamespace(id) {
  const s = (id || "").toLowerCase();
  if (!s) return "minecraft:air";
  if (s.includes(":")) return s;
  return `minecraft:${s}`;
}

function normalizeFamily(f) {
  if (f === "stained_hardened_clay" || f === "hardened_clay")
    return "terracotta";
  return f;
}

function parseVariant(variantName) {
  const m =
    /^minecraft:([a-z_]+)_(wool|carpet|concrete|concrete_powder|terracotta|glazed_terracotta|stained_glass|stained_glass_pane)$/.exec(
      variantName
    );
  if (!m) return null;
  return { color: normColorToken(m[1]), family: normalizeFamily(m[2]) };
}

// 逆順/旧式 → color_family へ
function normalizeToVariantName(ns) {
  let id = ns;

  let m = /^minecraft:powder_([a-z_]+)_concrete$/.exec(id);
  if (m) return `minecraft:${normColorToken(m[1])}_concrete_powder`;

  m = /^minecraft:glazed_terracotta_([a-z_]+)$/.exec(id);
  if (m) return `minecraft:${normColorToken(m[1])}_glazed_terracotta`;

  m = /^minecraft:hardened_clay_stained_([a-z_]+)$/.exec(id);
  if (m) return `minecraft:${normColorToken(m[1])}_terracotta`;

  m = /^minecraft:stained_clay_([a-z_]+)$/.exec(id);
  if (m) return `minecraft:${normColorToken(m[1])}_terracotta`;

  m =
    /^(?:minecraft|bedrock):(?:(wool|carpet|concrete|concrete_powder|terracotta|stained_glass|stained_glass_pane))_(?:colored_)?([a-z_]+)$/.exec(
      id
    );
  if (m) {
    const fam = normalizeFamily(m[1]);
    const color = normColorToken(m[2]);
    return `minecraft:${color}_${fam}`;
  }

  m = /^(?:minecraft|bedrock):([a-z_]+)_glazed_terracotta$/.exec(id);
  if (m) return `minecraft:${normColorToken(m[1])}_glazed_terracotta`;

  return id;
}

// -------------------------------------------------------------
// palette 最終関門（ホワイトリスト）
// -------------------------------------------------------------
const ALLOW_FAMILIES = [
  "wool",
  "concrete",
  "concrete_powder",
  "terracotta",
  "glazed_terracotta",
];
const VALID_VARIANTS = new Set(
  ALLOW_FAMILIES.flatMap((fam) => COLORS.map((c) => `minecraft:${c}_${fam}`))
);

// “？土”対策：危険な単体は色ブロックへ強制
const FORCE_MAP = new Map([
  ["minecraft:emerald_block", "minecraft:lime_concrete"],
  ["minecraft:gold_block", "minecraft:yellow_concrete"],
  ["minecraft:end_stone", "minecraft:yellow_concrete"],
  ["minecraft:sponge", "minecraft:yellow_concrete"],
  ["minecraft:moss_block", "minecraft:lime_concrete"],
  ["minecraft:exposed_cut_copper", "minecraft:orange_concrete"],
  ["minecraft:cut_copper", "minecraft:orange_concrete"],
  ["minecraft:stripped_birch_log", "minecraft:light_gray_concrete"],
  ["minecraft:stripped_dark_oak_log", "minecraft:brown_concrete"],
]);

const SAFE_DEFAULT = "minecraft:white_concrete";

function coerceFamily({ color, family }) {
  if (!ALLOW_FAMILIES.includes(family)) {
    return { color, family: "concrete" };
  }
  return { color, family };
}

// Java/Bedrockっぽい様々なID → variant-name（文字列）
function toVariantName(javaLikeId) {
  const raw = ensureNamespace(javaLikeId);
  if (FORCE_MAP.has(raw)) return FORCE_MAP.get(raw);

  let id = raw.replace(/^bedrock:/, "minecraft:");
  id = normalizeToVariantName(id);

  if (
    /^minecraft:[a-z_]+_(wool|carpet|concrete|concrete_powder|terracotta|glazed_terracotta|stained_glass|stained_glass_pane)$/.test(
      id
    )
  ) {
    return id;
  }

  const m =
    /^minecraft:(wool|carpet|concrete|concrete_powder|stained_hardened_clay|stained_glass|stained_glass_pane)\[(?:.+)?color=(\w+)(?:.+)?\]$/.exec(
      id
    );
  if (m) {
    const fam = normalizeFamily(m[1]);
    const rawc = m[2];
    const color = /^\d+$/.test(rawc)
      ? COLORS[parseInt(rawc, 10) || 0]
      : normColorToken(rawc);
    if (fam === "stained_glass" || fam === "stained_glass_pane")
      return `minecraft:${color}_concrete`;
    return `minecraft:${color}_${fam}`;
  }

  return id;
}

// palette 投入直前の絶対正規化
function canonicalizeToAllowedVariant(idLike) {
  const id = toVariantName(idLike);
  if (VALID_VARIANTS.has(id)) return id;

  const p = parseVariant(id);
  if (p) {
    const { color, family } = coerceFamily(p);
    const v = `minecraft:${color}_${family}`;
    if (VALID_VARIANTS.has(v)) return v;
  }

  if (FORCE_MAP.has(id)) return FORCE_MAP.get(id);
  return SAFE_DEFAULT;
}

// Bedrock palette entry（statesは使わない）
function toBedrockBlock(idLike) {
  const variant = canonicalizeToAllowedVariant(idLike);
  return { name: variant, states: {} };
}

// -------------------------------------------------------------
// Canvas → モデル
// -------------------------------------------------------------
function buildModelFromCanvas(state) {
  const cnv = els.resultCanvas;
  const w = cnv?.width ?? 0,
    h = cnv?.height ?? 0;
  if (!w || !h) return null;

  const ctx = cnv.getContext("2d", { willReadFrequently: true });

  let d;
  if (
    state.finalImageData &&
    state.finalImageData.width === w &&
    state.finalImageData.height === h
  ) {
    d = state.finalImageData.data;
  } else {
    const img = ctx.getImageData(0, 0, w, h);
    d = img.data;
  }

  const palette =
    state.paletteSnapshot && state.paletteSnapshot.length
      ? state.paletteSnapshot
      : state.activePalette;

  const rgbToJava = new Map();
  for (const [r, g, b, id] of palette) {
    rgbToJava.set(`${r},${g},${b}`, id);
  }

  let missMap = 0;
  const ids = new Array(w * h);
  const nameSet = new Set();

  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const i = (z * w + x) * 4;
      const key = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      const found = rgbToJava.get(key);
      if (!found) missMap++;
      const id = found || "minecraft:air";
      const idLike = toVariantName(id);
      ids[z * w + x] = idLike;
      nameSet.add(idLike);
    }
  }

  console.log(
    "[mcstructure] palette size:",
    palette.length,
    "unmapped rgb -> air:",
    missMap,
    "of",
    w * h,
    "unique names(raw):",
    nameSet.size
  );

  return { width: w, height: h, ids, names: Array.from(nameSet) };
}

// -------------------------------------------------------------
// 座標マッピング（回転＆反転）
// 出力絶対座標 (axOut, azOut) → 元画像座標 (srcX, srcZ)
//   90°CW の逆写像：
//     oldX = newY
//     oldY = (H0 - 1) - newX
// -------------------------------------------------------------
function mapOutToSrc(axOut, azOut, model, outW) {
  const xOut = FLIP_X ? outW - 1 - axOut : axOut; // 回転後Xで水平反転
  const zOut = azOut;

  if (ROTATE_DEG === 0) {
    return { srcX: xOut, srcZ: zOut };
  } else {
    // 正しい 90°CW 逆写像（上下逆/CCW化していたのを修正）
    const srcX = zOut; // oldX = newY
    const srcZ = model.height - 1 - xOut; // oldY = (H0-1) - newX
    return { srcX, srcZ };
  }
}

// -------------------------------------------------------------
// モデル → mcstructure 1チャンク
//   sxOut,szOut は“回転後の出力座標系”での原点
//   outW は反転基準のため出力全体の幅
// -------------------------------------------------------------
function buildMcstructureRoot(model, sxOut, szOut, W, H, outW) {
  const block_palette = [];
  const indexOf = new Map();

  const put = (idLike) => {
    const { name, states } = toBedrockBlock(idLike);
    const key = name + JSON.stringify(states);
    if (indexOf.has(key)) return indexOf.get(key);
    const idx = block_palette.length;
    block_palette.push({ name, states, version: BLOCK_VERSION });
    indexOf.set(key, idx);
    return idx;
  };

  const primary = new Array(W * H);
  let p = 0;

  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const axOut = sxOut + x;
      const azOut = szOut + z;

      const { srcX, srcZ } = mapOutToSrc(axOut, azOut, model, outW);

      if (srcX < 0 || srcZ < 0 || srcX >= model.width || srcZ >= model.height) {
        primary[p++] = put("minecraft:air");
      } else {
        const idx = srcZ * model.width + srcX;
        const idLike = model.ids[idx];
        primary[p++] =
          idLike === undefined ? put("minecraft:air") : put(idLike);
      }
    }
  }

  const secondary = new Array(primary.length).fill(-1);

  // debug
  const airKey = "minecraft:air{}";
  const airIdx = [...indexOf.entries()].find(([k]) => k === airKey)?.[1];
  let airCount = 0;
  if (airIdx !== undefined)
    for (const v of primary) if (v === airIdx) airCount++;

  console.log(
    "[mcstructure] chunk W×H=",
    W,
    "×",
    H,
    "primary len:",
    primary.length,
    "palette len:",
    block_palette.length,
    "air in primary:",
    airCount
  );

  return {
    format_version: 1,
    size: [W, 1, H],
    structure: {
      block_indices: [primary, secondary],
      entities: [],
      palette: { default: { block_palette, block_position_data: {} } },
    },
    structure_world_origin: [0, 0, 0],
  };
}

// -------------------------------------------------------------
// ファイル名ベースの取得：<input id="imageInput"> から取得
//   ・最優先: #imageInput の選択ファイル名（拡張子除去）
//   ・フォールバック: state.exportBaseName / state.sourceFilename / "mapart"
// -------------------------------------------------------------
function getBaseName(state) {
  let base = "";

  try {
    const inp = document.getElementById("imageInput");
    if (inp && inp.files && inp.files[0] && inp.files[0].name) {
      base = inp.files[0].name;
    }
  } catch (_) {
    // SSR等で document が無い場合は無視
  }

  if (!base) {
    base =
      state?.exportBaseName ||
      state?.sourceFilename ||
      state?.fileName ||
      state?.imageName ||
      "mapart";
  }

  const just = String(base).split(/[\\/]/).pop();
  const noext = just.replace(/\.[^.]+$/, "");
  return noext || "mapart";
}

function tileFileName(base, tx, tz) {
  return `${base}_X${tz}_Y${tx}.mcstructure`;
}

// -------------------------------------------------------------
// Exporters
// -------------------------------------------------------------
export function exportMcstructure(state) {
  const model = buildModelFromCanvas(state);
  if (!model) {
    alert("先に画像を変換してください。");
    return;
  }

  // 回転後の出力サイズ
  const outW = ROTATE_DEG === 0 ? model.width : model.height;
  const outH = ROTATE_DEG === 0 ? model.height : model.width;

  const base = getBaseName(state);
  const writer = new NbtWriterBE();

  if (outW <= MAX_XZ && outH <= MAX_XZ) {
    const root = buildMcstructureRoot(model, 0, 0, outW, outH, outW);
    const raw = writer.writeNamedCompound("", root);
    saveAs(
      new Blob([raw], { type: "application/octet-stream" }),
      tileFileName(base, 0, 0)
    );
    return;
  }

  const tilesX = Math.ceil(outW / MAX_XZ);
  const tilesZ = Math.ceil(outH / MAX_XZ);
  const zip = new JSZip();

  for (let tz = 0; tz < tilesZ; tz++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const sxOut = tx * MAX_XZ;
      const szOut = tz * MAX_XZ;
      const W = Math.min(MAX_XZ, outW - sxOut);
      const H = Math.min(MAX_XZ, outH - szOut);
      const root = buildMcstructureRoot(model, sxOut, szOut, W, H, outW);
      const raw = writer.writeNamedCompound("", root);
      zip.file(tileFileName(base, tx, tz), raw);
    }
  }

  zip
    .generateAsync({ type: "blob" })
    .then((blob) => saveAs(blob, `${base}_tiles_${tilesX}x${tilesZ}.zip`));
}

export function exportDebugMcstructure() {
  const palette = [
    {
      name: "minecraft:light_gray_concrete",
      states: {},
      version: BLOCK_VERSION,
    },
    { name: "minecraft:black_wool", states: {}, version: BLOCK_VERSION },
    { name: "minecraft:gray_terracotta", states: {}, version: BLOCK_VERSION },
    { name: "minecraft:air", states: {}, version: BLOCK_VERSION },
  ];
  const primary = [0, 1, 2, 3];
  const secondary = [-1, -1, -1, -1];
  const structure = {
    format_version: 1,
    size: [1, 1, 4],
    structure: {
      block_indices: [primary, secondary],
      entities: [],
      palette: { default: { block_palette: palette, block_position_data: {} } },
    },
    structure_world_origin: [0, 0, 0],
  };
  const writer = new NbtWriterBE();
  const raw = writer.writeNamedCompound("", structure);
  saveAs(
    new Blob([raw], { type: "application/octet-stream" }),
    "debug_variant_name.mcstructure"
  );
}
