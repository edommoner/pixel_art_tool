// js/palettes/dynamic-source-octopuchi-game8.js
import {
  OCTOPUCHI_ALLOWLIST,
  GAME8_COLOR_LABELS_JA,
} from "./octopuchi-game8-allowlist.js";

// 永続化キー
const LS_DYNAMIC_BLOCKS = "pixelart.dynamicBlocks.v1";

// util: ラベルのゆらぎ対策（小文字化・スペース/「の」除去・括弧内除去）
function normLabel(s) {
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
  ["grey", "gray"],
]);
function canonColorToken(t) {
  const x = t.toLowerCase();
  return COLOR_ALIAS.get(x) || x;
}
function basenameNoExt(id) {
  const s = id.split("/").pop();
  return s ? s.replace(/\.[a-z0-9]+$/, "") : id;
}
function makeIdAliases(raw) {
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
    const ja = labelRaw || m.label || idRaw;
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

// UI ヘルパ：カテゴリの日本語名を返す
export function game8CategoryJa(key) {
  return GAME8_COLOR_LABELS_JA[key] || key;
}
