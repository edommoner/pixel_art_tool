// js/palettes/dynamic-source-octopuchi-game8.js
import {
  OCTOPUCHI_ALLOWLIST,
  GAME8_COLOR_LABELS_JA,
} from "./octopuchi-game8-allowlist.js";

// 永続化キー
const LS_DYNAMIC_BLOCKS = "pixelart.dynamicBlocks.v1";

// util: ラベルのゆらぎ対策（スペースや「の」を除く）
function norm(s) {
  return (s || "").toString().replace(/\s+/g, "").replace(/の/g, "");
}

// util: allowlist 検索用 index
const byId = new Map();
const byLabel = new Map();
for (const e of OCTOPUCHI_ALLOWLIST) {
  if (e.ids) for (const id of e.ids) byId.set(id, e);
  byLabel.set(norm(e.label), e);
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

  for (const b of dynamicList) {
    const id = b.id || b.name || b.block || b.bedrock || "";
    const label = b.label || b.displayName || "";
    const m =
      byId.get(id) ||
      byId.get(id.replace(/^minecraft:/, "")) || // idがminecraft:無しのことも
      byLabel.get(norm(label));

    if (!m) continue; // ホワイトリスト外は落とす

    const cat = m.category || "other";
    const rgb = b.rgb || b.color || [0, 0, 0];
    const ja = label || m.label || id;
    cats[cat].push([rgb[0], rgb[1], rgb[2], id || "minecraft:air", ja]);
  }

  // 空カテゴリは削除
  for (const k of Object.keys(cats)) {
    if (!cats[k].length) delete cats[k];
  }

  // 保存
  const payload = { cats, savedAt: Date.now() };
  try {
    localStorage.setItem(LS_DYNAMIC_BLOCKS, JSON.stringify(payload));
  } catch {}

  return payload;
}

// UI ヘルパ：カテゴリの日本語名を返す
export function game8CategoryJa(key) {
  return GAME8_COLOR_LABELS_JA[key] || key;
}
