// tool/js/export/mcstructure.js (variant-name palette)
import { els } from "../ui/elements.js";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { NbtWriterBE } from "../nbt/writer.js";

const MAX_XZ = 64;
const BLOCK_VERSION = 18168865;
const FLIP_X = true;

// --- variant-name palette table ---
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
const makeName = (base, idx) => `minecraft:${COLORS[idx]}_${base}`;

// Map RGB->java-like id (e.g., minecraft:blue_wool) comes from state.activePalette
function toBedrockName(javaLikeId) {
  // accept already variant-in-name
  if (/^minecraft:[a-z_]+_(wool|concrete|terracotta)$/.test(javaLikeId))
    return javaLikeId;
  // try to convert base+color state forms back to variant-name (not expected in your UI, but safe):
  const m =
    /^minecraft:(wool|concrete|stained_hardened_clay)\[(?:.+)?color=(\d+)(?:.+)?\]$/.exec(
      javaLikeId
    );
  if (m) {
    const kind = m[1] === "stained_hardened_clay" ? "terracotta" : m[1];
    const idx = parseInt(m[2], 10) || 0;
    return `minecraft:${COLORS[idx]}_${kind}`;
  }
  return "minecraft:air";
}

function buildModelFromCanvas(state) {
  const cnv = els.resultCanvas;
  const w = cnv?.width ?? 0,
    h = cnv?.height ?? 0;
  if (!w || !h) return null;
  const ctx = cnv.getContext("2d", { willReadFrequently: true });
  // ★ 出力は必ずスナップショットから読む（なければ従来どおり）
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
      : state.activePalette; // ★
  const rgbToJava = new Map();
  for (const [r, g, b, id] of palette) {
    rgbToJava.set(`${r},${g},${b}`, id);
  }

  // ★ DEBUG: パレット未一致カウンタとサンプル
  let missMap = 0;
  const missSamples = [];

  const ids = new Array(w * h);
  const nameSet = new Set();
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const i = (z * w + x) * 4;
      const key = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      const found = rgbToJava.get(key);
      if (!found) {
        missMap++;
        if (missSamples.length < 20) missSamples.push({ x, z, rgb: key });
      }
      const id = found || "minecraft:air";
      const name = toBedrockName(id);
      ids[z * w + x] = name;
      nameSet.add(name);
    }
  }
  // ★ DEBUG: 量とサンプルを表示
  console.log(
    "[mcstructure] palette size:",
    palette.length,
    "unmapped rgb -> air:",
    missMap,
    "of",
    w * h,
    "unique bedrock names:",
    nameSet.size
  );
  if (missSamples.length)
    console.log("[mcstructure] first unmapped samples:", missSamples);

  return { width: w, height: h, ids, names: Array.from(nameSet) };
}

function buildMcstructureRoot(model, sx, sz, W, H) {
  const block_palette = [];
  const indexOf = new Map();
  const put = (name) => {
    if (indexOf.has(name)) return indexOf.get(name);
    const idx = block_palette.length;
    block_palette.push({ name, states: {}, version: BLOCK_VERSION });
    indexOf.set(name, idx);
    return idx;
  };

  const primary = new Array(W * H);
  let p = 0;
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const srcX = FLIP_X ? sx + (W - 1 - x) : sx + x;
      const name = model.ids[(sz + z) * model.width + srcX] || "minecraft:air";

      primary[p++] = put(name);
    }
  }
  const secondary = new Array(primary.length).fill(-1);
  // ★ DEBUG: 長さ・エア個数・パレット数を確認
  const airIdx = indexOf.get("minecraft:air");
  let airCount = 0;
  if (airIdx !== undefined) {
    for (const v of primary) if (v === airIdx) airCount++;
  }
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

export function exportMcstructure(state) {
  const model = buildModelFromCanvas(state);
  if (!model) {
    alert("先に画像を変換してください。");
    return;
  }
  const writer = new NbtWriterBE();
  if (model.width <= MAX_XZ && model.height <= MAX_XZ) {
    const root = buildMcstructureRoot(model, 0, 0, model.width, model.height);
    const raw = writer.writeNamedCompound("", root);
    saveAs(
      new Blob([raw], { type: "application/octet-stream" }),
      `mapart_${model.width}x${model.height}.mcstructure`
    );
    return;
  }
  const tilesX = Math.ceil(model.width / MAX_XZ);
  const tilesZ = Math.ceil(model.height / MAX_XZ);
  const zip = new JSZip();
  for (let tz = 0; tz < tilesZ; tz++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const sx = tx * MAX_XZ,
        sz = tz * MAX_XZ;
      const W = Math.min(MAX_XZ, model.width - sx);
      const H = Math.min(MAX_XZ, model.height - sz);
      const root = buildMcstructureRoot(model, sx, sz, W, H);
      const raw = writer.writeNamedCompound("", root);
      zip.file(`mapart_x${tx}_z${tz}_${W}x${H}.mcstructure`, raw);
    }
  }
  zip
    .generateAsync({ type: "blob" })
    .then((blob) =>
      saveAs(
        blob,
        `mapart_mcstructure_tiles_${model.width}x${model.height}.zip`
      )
    );
}

export function exportDebugMcstructure() {
  // palette with variant-in-name
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
