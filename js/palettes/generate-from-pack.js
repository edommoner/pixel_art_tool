// js/palettes/generate-from-pack.js
import JSZip from "jszip";

// 透過を除いた平均色を計算
async function avgRgbFromPng(bytes) {
  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const w = img.naturalWidth,
      h = img.naturalHeight;
    const cvs = document.createElement("canvas");
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    let r = 0,
      g = 0,
      b = 0,
      c = 0;
    // スピード重視で間引き（4px刻み）
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const i = (y * w + x) * 4;
        const a = data[i + 3];
        if (a > 128) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          c++;
        }
      }
    }
    if (!c) return [0, 0, 0];
    return [Math.round(r / c), Math.round(g / c), Math.round(b / c)];
  } finally {
    URL.revokeObjectURL(url);
  }
}

// カテゴリ振り分け規則（必要に応じて拡張）
const CATEGORY_RULES = [
  { re: /^([a-z_]+)_wool$/, cat: "wool" },
  { re: /^([a-z_]+)_carpet$/, cat: "carpet" },
  { re: /^([a-z_]+)_concrete$/, cat: "concrete" },
  { re: /^([a-z_]+)_concrete_powder$/, cat: "concrete_powder" },
  { re: /^([a-z_]+)_terracotta$/, cat: "terracotta" },
  { re: /^([a-z_]+)_glazed_terracotta$/, cat: "glazed_terracotta" },
  { re: /^([a-z_]+)_stained_glass(_pane)?$/, cat: "stained_glass" },
  { re: /^([a-z_]+)_candle(_?[0-9]*)?$/, cat: "candle" },
  { re: /^([a-z_]+)_shulker_box$/, cat: "shulker_box" },
  { re: /^([a-z_]+)_bed$/, cat: "bed" },
  { re: /^([a-z_]+)_banner$/, cat: "banner" },

  { re: /^.*_planks$/, cat: "planks" },
  {
    re: /^(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo).*log.*$/,
    cat: "logs",
  },
  {
    re: /^(stripped_)?(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo).*$/,
    cat: null,
  }, // 無分類は後段

  {
    re: /^(stone|granite|polished_granite|diorite|polished_diorite|andesite|polished_andesite|tuff|calcite|dripstone_block|blackstone|deepslate|basalt|smooth_basalt)$/,
    cat: "stone_like",
  },
  { re: /^(sandstone.*|red_sandstone.*)$/, cat: "sandstone" },
  { re: /^quartz.*$/, cat: "quartz" },
  { re: /^prismarine(_bricks|_dark)?$/, cat: "prismarine" },
  { re: /^copper.*$/, cat: "copper" },
  { re: /^(netherrack|nether_bricks.*|red_nether_bricks)$/, cat: "nether" },
  { re: /^(end_stone|purpur.*)$/, cat: "end" },
  {
    re: /^(amethyst_block|bone_block|clay|bricks|mud(_bricks)?|moss_block|snow_block|ice|packed_ice|blue_ice)$/,
    cat: "etc_solid",
  },
];

// バイオーム色に依存する代表的テクスチャ（除外候補）
const BIOME_TINTED = new Set([
  "grass_block_top",
  "grass_block_side",
  "grass",
  "tall_grass",
  "fern",
  "large_fern_top",
  "large_fern_bottom",
  "oak_leaves",
  "spruce_leaves",
  "birch_leaves",
  "jungle_leaves",
  "acacia_leaves",
  "dark_oak_leaves",
  "mangrove_leaves",
  "cherry_leaves",
  "azalea_leaves",
  "flowering_azalea_leaves",
  "water_still",
  "water_flow",
]);

export async function generatePaletteFromVanillaZip(
  file,
  { skipBiomeTint = true } = {}
) {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.keys(zip.files).filter(
    (p) =>
      p.startsWith("assets/minecraft/textures/block/") && p.endsWith(".png")
  );
  const categories = new Map(); // cat -> array
  const flat = [];

  const push = (cat, entry) => {
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat).push(entry);
    flat.push(entry);
  };

  for (const path of entries) {
    const name = path.split("/").pop().replace(".png", "");
    if (skipBiomeTint && BIOME_TINTED.has(name)) continue;

    // ブロックID推定
    const blockId = `minecraft:${name}`;

    // カテゴリ決定
    let cat = "others";
    for (const rule of CATEGORY_RULES) {
      const m = name.match(rule.re);
      if (m) {
        if (rule.cat) cat = rule.cat;
        break;
      }
    }

    const bytes = await zip.files[path].async("uint8array");
    const rgb = await avgRgbFromPng(bytes);

    // 日本語名はとりあえず英名を置く（後で翻訳テーブルで差し替え可）
    push(cat, [rgb[0], rgb[1], rgb[2], blockId, name]);
  }

  // 近似重複（waxed_* 等）は色が同じなので blockId で一意化
  for (const [cat, arr] of categories) {
    const seen = new Set();
    categories.set(
      cat,
      arr.filter((x) => {
        if (seen.has(x[3])) return false;
        seen.add(x[3]);
        return true;
      })
    );
  }

  return {
    categories: Object.fromEntries(categories),
    flat,
  };
}
