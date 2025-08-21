// js/palettes/dynamic-source-octopuchi-game8.js
import {
  OCTOPUCHI_ALLOWLIST,
  GAME8_COLOR_LABELS_JA,
} from "./octopuchi-game8-allowlist.js";

// 永続化キー
const LS_DYNAMIC_BLOCKS = "pixelart.dynamicBlocks.v1";

// util: ラベルのゆらぎ対策（小文字化・スペース/「の」除去・括弧内除去）
export function normLabel(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/の/g, "")
    .replace(/（.*?）/g, "");
}
// util: ID正規化（小文字化・名前空間除去・state/variant断片の切り落とし）
function normId(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/^minecraft:/, "")
    .replace(/^bedrock:/, "")
    .replace(/^java:/, "")
    .replace(/\[.*\]$/, ""); // "oak_log[axis=y]" → "oak_log"
}

// Bedrock系テクスチャ名 → Java風 正規ID へのエイリアス生成
// 例:
//  wool_colored_orange        → orange_wool
//  hardened_clay_stained_cyan → cyan_terracotta
//  concrete_powder_red        → red_concrete_powder
//  concrete_blue              → blue_concrete
//  glazed_terracotta_green    → green_glazed_terracotta
//  stained_glass_magenta      → magenta_stained_glass
//  carpet_light_gray / wool_carpet_light_gray → light_gray_carpet
const COLOR_ALIAS = new Map([
  ["lightblue", "light_blue"],
  ["lightgrey", "light_gray"],
  ["lightgray", "light_gray"], // 追加：US表記
  ["silver", "light_gray"], // 追加：旧称
  ["grey", "gray"],
  ["lightgreen", "lime"], // 追加：たまに見かける別名
  ["fuchsia", "magenta"], // 追加：まれに見かける別名
]);
function canonColorToken(t) {
  const x = t.toLowerCase();
  return COLOR_ALIAS.get(x) || x;
}
function basenameNoExt(id) {
  const s = id.split("/").pop();
  return s ? s.replace(/\.[a-z0-9]+$/, "") : id;
}
export function makeIdAliases(raw) {
  const out = new Set();
  const full = (raw || "").toString().toLowerCase();
  const bare = normId(full);
  const base = basenameNoExt(bare);

  out.add(full); // そのまま
  out.add(bare); // 名前空間除去
  out.add(`minecraft:${bare}`);

  // wool_colored_orange
  let m = base.match(/^wool_colored_([a-z_]+)$/);
  if (m) {
    const c = canonColorToken(m[1]);
    out.add(`${c}_wool`);
    out.add(`minecraft:${c}_wool`);
  }
  // 追加：wool_white / wool_silver など（colored が付かない系）
  m = base.match(/^wool_([a-z_]+)$/);
  if (m) {
    const c = canonColorToken(m[1]);
    out.add(`${c}_wool`);
    out.add(`minecraft:${c}_wool`);
  }
  // hardened_clay_stained_cyan / stained_hardened_clay_cyan
  m = base.match(/^(?:hardened_clay_stained|stained_hardened_clay)_([a-z_]+)$/);
  if (m) {
    const c = canonColorToken(m[1]);
    out.add(`${c}_terracotta`);
    out.add(`minecraft:${c}_terracotta`);
  }
  // concrete_powder_red
  m = base.match(/^concrete_powder_([a-z_]+)$/);
  if (m) {
    const c = canonColorToken(m[1]);
    out.add(`${c}_concrete_powder`);
    out.add(`minecraft:${c}_concrete_powder`);
  }
  // concrete_blue
  m = base.match(/^concrete_([a-z_]+)$/);
  if (m) {
    const c = canonColorToken(m[1]);
    out.add(`${c}_concrete`);
    out.add(`minecraft:${c}_concrete`);
  }
  // glazed_terracotta_green
  m = base.match(/^glazed_terracotta_([a-z_]+)$/);
  if (m) {
    const c = canonColorToken(m[1]);
    out.add(`${c}_glazed_terracotta`);
    out.add(`minecraft:${c}_glazed_terracotta`);
  }
  // stained_glass_magenta / stained_glass_pane_magenta
  m = base.match(/^stained_glass(?:_pane)?_([a-z_]+)$/);
  if (m) {
    const c = canonColorToken(m[1]);
    out.add(`${c}_stained_glass`);
    out.add(`minecraft:${c}_stained_glass`);
    out.add(`${c}_stained_glass_pane`);
    out.add(`minecraft:${c}_stained_glass_pane`);
  }
  // carpet_light_gray / wool_carpet_light_gray
  m = base.match(/^(?:wool_)?carpet_([a-z_]+)$/);
  if (m) {
    const c = canonColorToken(m[1]);
    out.add(`${c}_carpet`);
    out.add(`minecraft:${c}_carpet`);
  }
  return [...out];
}

// === 日本語ラベル判定（小文字化だと日本語に影響ないが統一のため toString()） ===
function hasJa(s, ...words) {
  const t = (s || "").toString();
  return words.some((w) => t.includes(w));
}
function anyJaOf(s, arr) {
  const t = (s || "").toString();
  return arr.some((w) => t.includes(w));
}

// --- 素材推定（id から素材キーを推測） ---
export function inferMaterialFromId(idBare) {
  if (/^.+_wool$/.test(idBare)) return "wool";
  if (/^.+_carpet$/.test(idBare)) return "carpet";
  if (/^.+_concrete_powder$/.test(idBare)) return "concrete_powder";
  if (/^.+_concrete$/.test(idBare)) return "concrete";
  if (/^.+_glazed_terracotta$/.test(idBare)) return "glazed_terracotta";
  if (/^.+_terracotta$/.test(idBare)) return "terracotta";
  if (/^.+_stained_glass_pane$/.test(idBare)) return "stained_glass_pane";
  if (/^.+_stained_glass$/.test(idBare)) return "stained_glass";
  if (/^.+_planks$/.test(idBare)) return "planks";
  if (/^stripped_.+_(log|wood)$/.test(idBare)) return "stripped_log";
  if (/^.+_log$/.test(idBare)) return "log";
  if (/^.+_wood$/.test(idBare)) return "wood";
  if (/^.+_leaves$/.test(idBare)) return "leaves";
  if (/mushroom_block$/.test(idBare)) return "mushroom_block";
  if (/copper/.test(idBare)) return "copper";
  if (/^gold_block$/.test(idBare)) return "gold";
  if (/^raw_gold_block$/.test(idBare)) return "raw_gold";
  if (/^end_stone(_bricks)?$/.test(idBare)) return "end_stone";
  if (/^packed_mud$/.test(idBare)) return "packed_mud";
  if (/^moss_block$/.test(idBare)) return "moss_block";
  if (/^melon$/.test(idBare)) return "melon";
  return "other";
}
export const MATERIAL_LABEL_JA = {
  wool: "羊毛",
  carpet: "カーペット",
  concrete: "コンクリート",
  concrete_powder: "コンクリートパウダー",
  terracotta: "テラコッタ",
  glazed_terracotta: "彩釉テラコッタ",
  stained_glass: "色付きガラス",
  stained_glass_pane: "色付きガラス板",
  planks: "板材",
  log: "原木",
  stripped_log: "樹皮を剥いだ原木",
  wood: "木",
  leaves: "葉",
  mushroom_block: "キノコブロック",
  copper: "銅系",
  gold: "金ブロック",
  raw_gold: "金の原石ブロック",
  end_stone: "エンドストーン",
  packed_mud: "固めた泥",
  moss_block: "苔ブロック",
  melon: "スイカ",
  other: "その他",
};
export function materialLabelJa(key) {
  return MATERIAL_LABEL_JA[key] || key;
}

// === Game8ブロック種別（英語キー） → 日本語表示名 ===
export const BLOCKCAT_LABELS_JA = {
  stone: "石",
  dirt: "土",
  wood: "木材",
  ore: "鉱石",
  sand: "砂",
  glass: "ガラス",
  wool: "羊毛",
  bricks: "レンガ",
  terracotta: "テラコッタ",
  concrete: "コンクリート",
  slab: "ハーフブロック",
  stairs: "階段",
  sponge: "スポンジ",
  nether: "ネザー系ブロック",
  end: "エンド系ブロック",
  prismarine: "プリズマリンブロック",
  coral: "サンゴブロック",
  other: "その他",
};
export function blockcatLabelJa(k) {
  return BLOCKCAT_LABELS_JA[k] || k;
}

// util: allowlist 検索用 index
const byId = new Map();
const byLabel = new Map();
for (const e of OCTOPUCHI_ALLOWLIST) {
  if (e.ids) {
    for (const raw of e.ids) {
      const full = (raw || "").toString().toLowerCase(); // 例: "minecraft:oak_planks"
      const bare = normId(raw); // 例: "oak_planks"
      byId.set(full, e);
      byId.set(bare, e);
    }
  }
  byLabel.set(normLabel(e.label), e);
}

// public: 取り込み開始前に一度クリア
export function clearDynamicBlocksOnce() {
  try {
    localStorage.removeItem(LS_DYNAMIC_BLOCKS);
  } catch {}
}

// public: 保存済みを復元（起動時）
export function loadSavedDynamicBlocks() {
  try {
    const raw = localStorage.getItem(LS_DYNAMIC_BLOCKS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.cats ? parsed : null;
  } catch {
    return null;
  }
}

// public: 動的リスト（[{rgb:[r,g,b], id, label}] 想定）を絞り込み → { cats, labels } 返す
export function applyOctopuchiGame8Filter(dynamicList) {
  // cats: { categoryKey: [ [r,g,b,id,label], ... ] }
  const cats = {};
  for (const key of Object.keys(GAME8_COLOR_LABELS_JA)) cats[key] = [];

  let scanned = 0,
    matched = 0;
  for (const b of dynamicList) {
    const idRaw = (b.id || b.name || b.block || b.bedrock || "").toString();
    const idKeys = makeIdAliases(idRaw); // ← ★ ここがポイント：候補を大量生成
    const labelRaw = b.label || b.displayName || "";
    const labelKey = normLabel(labelRaw);
    scanned++;
    let m = null;
    for (const k of idKeys) {
      m = byId.get(k);
      if (m) break;
    }
    if (!m) m = byLabel.get(labelKey);

    if (!m) continue; // ホワイトリスト外は落とす

    const cat = m.category || "other";
    const rgb = b.rgb || b.color || [0, 0, 0];
    const ja = m.label || labelRaw || idRaw; // 日本語ラベルを最優先
    cats[cat].push([rgb[0], rgb[1], rgb[2], idRaw || "minecraft:air", ja]);
    matched++;
  }

  // 空カテゴリは削除
  for (const k of Object.keys(cats)) {
    if (!cats[k].length) delete cats[k];
  }

  // 保存（統計も入れておく）
  const payload = { cats, savedAt: Date.now(), stats: { scanned, matched } };
  try {
    localStorage.setItem(LS_DYNAMIC_BLOCKS, JSON.stringify(payload));
  } catch {}

  if (matched < 20) {
    const sample = dynamicList
      .slice(0, 200)
      .map((x) => (x.id || x.name || x.block || x.bedrock || "") + "");
    console.warn(
      "[octopuchi-filter] low match. sample ids:",
      sample.filter(Boolean).slice(0, 50)
    );
  }

  return payload;
}

// Game8 の色カテゴリを日本語に
export function game8CategoryJa(key) {
  return GAME8_COLOR_LABELS_JA[key] || key;
}

// ===== id/ラベル から Game8ブロック種別を推定 =====
export function inferBlockcatFromId(idBare) {
  // まずは専用カテゴリ（衝突しやすいので先）
  if (/sponge/.test(idBare)) return "sponge";
  if (/^end_stone(_bricks)?$|^purpur/.test(idBare)) return "end";
  if (/^prismarine|sea_lantern/.test(idBare)) return "prismarine";
  if (/coral/.test(idBare)) return "coral";
  if (/^stained_glass(?:_pane)?$|glass/.test(idBare)) return "glass";
  if (/(_wool|_carpet)$/.test(idBare)) return "wool"; // カーペットは羊毛へ合流
  if (/terracotta/.test(idBare)) return "terracotta";
  if (/concrete(_powder)?$/.test(idBare)) return "concrete";
  if (/_slab$/.test(idBare)) return "slab";
  if (/_stairs$/.test(idBare)) return "stairs";
  // ネザー系（広め）
  if (
    /^nether|netherrack|glowstone|blackstone|basalt|soul_(sand|soil)|crimson_|warped_/.test(
      idBare
    )
  )
    return "nether";
  // 砂系
  if (/^sand$|^red_sand$|sandstone/.test(idBare)) return "sand";
  // 木材
  if (/_planks$|_log$|^stripped_.*_(log|wood)$|_wood$/.test(idBare))
    return "wood";
  // 土系
  if (
    /^dirt$|^coarse_dirt$|^rooted_dirt$|^grass_block$|^mycelium$|^mud$|^packed_mud$|^mud_bricks$|^clay$|^podzol$/.test(
      idBare
    )
  )
    return "dirt";
  // 鉱石系（鉱石＋鉱石ブロック＋原石ブロック）
  if (/_ore$/.test(idBare)) return "ore";
  if (
    /^(?:coal|iron|gold|diamond|emerald|lapis|redstone|copper)_block$/.test(
      idBare
    )
  )
    return "ore";
  if (/^raw_(?:iron|gold|copper)_block$/.test(idBare)) return "ore";
  // 石系（最後に広め）
  if (
    /stone|deepslate|tuff|calcite|granite|diorite|andesite|cobblestone|obsidian|dripstone|blackstone|basalt/.test(
      idBare
    )
  )
    return "stone";
  return null;
}

export function inferBlockcatFromRow(row) {
  const idRaw = (row?.[3] || "").toString();
  const idBare = normId(idRaw);
  const ja = (row?.[4] || "").toString(); // 日本語ラベル（allowlist優先で入っている）

  // 1) IDベース推定（最も頑健）
  const byId = inferBlockcatFromId(idBare);
  if (byId) return byId;

  // 2) Bedrock テクスチャ系 → 正規IDエイリアスを作って再判定
  const aliases = makeIdAliases(idRaw).map(normId);
  for (const k of aliases) {
    const byAlias = inferBlockcatFromId(k);
    if (byAlias) return byAlias;
  }

  // 3) 日本語ラベルで推定（取りこぼし救済）
  if (hasJa(ja, "羊毛", "カーペット")) return "wool";
  if (hasJa(ja, "コンクリートパウダー", "コンクリート")) return "concrete";
  if (anyJaOf(ja, ["彩釉テラコッタ", "テラコッタ"])) return "terracotta";
  if (anyJaOf(ja, ["色付きガラス板", "色付きガラス", "ガラス"])) return "glass";
  if (anyJaOf(ja, ["板材", "原木", "樹皮を剥いだ", "木"])) return "wood";
  if (hasJa(ja, "レンガ")) return "bricks";
  if (anyJaOf(ja, ["スポンジ"])) return "sponge";
  if (anyJaOf(ja, ["砂岩", "砂"])) return "sand";
  if (anyJaOf(ja, ["エンドストーン", "プルプァ"])) return "end";
  if (anyJaOf(ja, ["プリズマリン", "シーランタン"])) return "prismarine";
  if (
    anyJaOf(ja, [
      "ネザー",
      "ブラックストーン",
      "玄武岩",
      "ソウルサンド",
      "ソウルソイル",
      "クリムゾン",
      "歪んだ",
    ])
  )
    return "nether";
  if (anyJaOf(ja, ["泥", "土", "草ブロック", "菌糸土", "粘土", "ポドゾル"]))
    return "dirt";
  if (
    anyJaOf(ja, [
      "鉱石",
      "原石",
      "ダイヤモンドブロック",
      "エメラルドブロック",
      "金ブロック",
      "鉄ブロック",
      "ラピスラズリブロック",
      "レッドストーンブロック",
      "銅ブロック",
    ])
  )
    return "ore";
  if (
    anyJaOf(ja, [
      "石",
      "閃緑岩",
      "花崗岩",
      "安山岩",
      "凝灰岩",
      "深層岩",
      "玄武岩",
      "黒曜石",
      "丸石",
      "鍾乳石",
    ])
  )
    return "stone";
  return "other";
}

// 追加：保存内容を任意の {cats} で上書き（色→ブロック種別へ切替保存などに使う）
export function overrideSavedDynamicBlocks(cats) {
  try {
    localStorage.setItem(
      LS_DYNAMIC_BLOCKS,
      JSON.stringify({ cats: cats || {}, savedAt: Date.now() })
    );
  } catch {}
}

// 表示順の既定（Game8目次準拠）
export const BLOCKCAT_ORDER = [
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

// ===== 「色カテゴリ → Game8ブロック種別」へ再編 =====
export function regroupCatsByGame8BlockCategory(colorCats) {
  const out = {};
  const push = (k, row) => {
    (out[k] || (out[k] = [])).push(row);
  };
  for (const arr of Object.values(colorCats || {})) {
    for (const it of arr) {
      const k = inferBlockcatFromRow(it) || "other";
      push(k, it);
    }
  }
  for (const k of Object.keys(out)) if (!out[k].length) delete out[k];
  return out;
}

// --- 色カテゴリ -> 素材カテゴリへ再編 ---
export function regroupCatsByMaterial(colorCats) {
  // 入力例: { white: [ [r,g,b,id,label], ...], yellow: [...], ... }
  const out = {};
  const push = (key, row) => {
    if (!out[key]) out[key] = [];
    out[key].push(row);
  };
  for (const arr of Object.values(colorCats || {})) {
    for (const it of arr) {
      const id = (it?.[3] || "")
        .toString()
        .toLowerCase()
        .replace(/^minecraft:/, "");
      const key = inferMaterialFromId(id);
      push(key, it);
    }
  }
  // 空配列を除去
  for (const k of Object.keys(out)) {
    if (!out[k].length) delete out[k];
  }
  return out;
}
