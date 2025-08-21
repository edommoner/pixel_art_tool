import { els } from "./ui/elements.js";
import { saveAs } from "file-saver";

import {
  blockcatLabelJa,
  inferBlockcatFromRow,
  BLOCKCAT_ORDER,
} from "./palettes/dynamic-source-octopuchi-game8.js";

// 永続化（並び替えモード）
const LS_SORT = "pixelart.countsSortMode.v1"; // "count" | "color"
// 直近に描画したテーブルの行（= 現在見えている内容そのまま）を保持
let lastRenderedRows = null; // [{category_label,id,label,r,g,b,count}]

function loadSort() {
  try {
    return localStorage.getItem(LS_SORT) || "count";
  } catch {
    return "count";
  }
}
function saveSort(mode) {
  try {
    localStorage.setItem(LS_SORT, mode);
  } catch {}
}

let lastGrouped = null; // CSV用に保持
let lastSort = loadSort();

// 色順ソート用：RGB→HSV（Hue→Sat→Value）
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

// ブロック種類ごとに集計
function groupCountsByBlockCategory(img, state) {
  // パレットの逆引き: "r,g,b" -> {id,label,rgb}
  const palette =
    (state.paletteSnapshot && state.paletteSnapshot.length
      ? state.paletteSnapshot
      : state.activePalette) || [];
  const keyToInfo = new Map();
  for (const row of palette) {
    // row: [r,g,b,id,label]
    const k = `${+row[0] | 0},${+row[1] | 0},${+row[2] | 0}`;
    keyToInfo.set(k, {
      id: (row[3] || "").toString(),
      label: (row[4] || "").toString(),
      rgb: [row[0] | 0, row[1] | 0, row[2] | 0],
    });
  }

  // カウント
  const counts = new Map(); // key=id -> {id,label,rgb,count}
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 255) continue; // 透明は無視
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    const info = keyToInfo.get(key);
    if (!info) continue;
    const rec = counts.get(info.id) || {
      id: info.id,
      label: info.label || info.id,
      rgb: info.rgb,
      count: 0,
    };
    rec.count++;
    counts.set(info.id, rec);
  }

  // 種別にまとめる
  const groups = {}; // cat -> [{...}]
  for (const rec of counts.values()) {
    // row形式にして、名寄せ＋日本語ラベル推定を含む汎用ロジックで分類
    const row = [rec.rgb[0], rec.rgb[1], rec.rgb[2], rec.id, rec.label];
    const cat = inferBlockcatFromRow(row) || "other";
    (groups[cat] || (groups[cat] = [])).push(rec);
  }
  return groups;
}

function sortItems(items, mode) {
  if (mode === "color") {
    return items.sort((a, b) => {
      const ha = rgbToHsv(a.rgb[0], a.rgb[1], a.rgb[2]);
      const hb = rgbToHsv(b.rgb[0], b.rgb[1], b.rgb[2]);
      if (ha.h !== hb.h) return ha.h - hb.h; // Hue
      if (ha.s !== hb.s) return hb.s - ha.s; // Sat（彩度高→低）
      return hb.v - ha.v; // Val（明るい→暗い）
    });
  }
  // 既定: 個数（降順）→ ラベル
  return items.sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja")
  );
}

function renderCounts(groups, sortMode) {
  // ホスト解決（既存の要素があれば使う）
  const host =
    document.getElementById("woolTable") ||
    document.getElementById("countsPanel") ||
    document.getElementById("tab3") ||
    document.body;

  // 既存ノードをクリア（テーブルごと入れ替える）
  let wrap = document.getElementById("countsWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "countsWrap";
    host.innerHTML = "";
    host.appendChild(wrap);
  } else {
    wrap.innerHTML = "";
  }

  // ソートUI
  const bar = document.createElement("div");
  bar.id = "countsSortBar";
  bar.style.display = "flex";
  bar.style.gap = "8px";
  bar.style.alignItems = "center";
  bar.style.margin = "6px 0";
  bar.innerHTML = `
    <strong>並び替え:</strong>
    <label><input type="radio" name="countsSort" value="count" ${sortMode === "count" ? "checked" : ""}> 個数</label>
    <label><input type="radio" name="countsSort" value="color" ${sortMode === "color" ? "checked" : ""}> 色</label>
  `;
  wrap.appendChild(bar);

  // 表
  const table = document.createElement("table");
  table.className = "counts-table";
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";
  table.innerHTML = `
    <thead>
      <tr>
      <th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">色</th>
      <th style="text-align:right;padding:4px;border-bottom:1px solid #ccc;">個数</th>
      <th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">ブロック</th>
        <th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">ID</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  // 表示順：既定は Game8 目次順
  const keys = Object.keys(groups);
  const ordered = BLOCKCAT_ORDER.filter((k) => keys.includes(k)).concat(
    keys.filter((k) => !BLOCKCAT_ORDER.includes(k))
  );

  // ★いま表示している内容のスナップショットを作る（CSV用）
  lastRenderedRows = [];

  for (const cat of ordered) {
    const items = sortItems([...groups[cat]], sortMode);
    // セクション見出し
    const trHead = document.createElement("tr");
    trHead.innerHTML = `<td colspan="4" style="padding:8px 4px;font-weight:700;border-top:1px solid #ddd;background:#f8f8f8;">
      ${blockcatLabelJa(cat)}（${items.length}）
    </td>`;
    tbody.appendChild(trHead);
    // 明細
    const catLabel = blockcatLabelJa(cat);
    for (const item of items) {
      const [r, g, b] = item.rgb;
      const swatch = `<span style="display:inline-block;width:14px;height:14px;border:1px solid #0003;background:rgb(${r},${g},${b});vertical-align:middle;margin-right:6px;"></span>`;
      const tr = document.createElement("tr");
      // <td style="padding:4px;">${swatch} ${r},${g},${b}</td>
      tr.innerHTML = `
      <td style="padding:4px;">${swatch} </td>
      <td style="padding:4px;text-align:right;">${item.count}</td>
      <td style="padding:4px;">${escapeHtml(item.label)}</td>
        <td style="padding:4px;font-family:monospace;">${escapeHtml(item.id)}</td>
      `;
      tbody.appendChild(tr);

      // ★スナップショットに1行追加（表示順どおり）
      lastRenderedRows.push({
        category_label: catLabel,
        id: item.id,
        label: item.label,
        r,
        g,
        b,
        count: item.count,
      });
    }
  }

  wrap.appendChild(table);

  // ソート切替
  wrap.querySelectorAll('input[name="countsSort"]').forEach((r) => {
    r.addEventListener("change", (ev) => {
      const mode = ev.target.value === "color" ? "color" : "count";
      lastSort = mode;
      saveSort(mode);
      renderCounts(groups, mode); // 再描画
    });
  });
}

function escapeHtml(s) {
  return (s == null ? "" : String(s))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ===== 公開API =====
export function updateCountsTable(img, state) {
  const groups = groupCountsByBlockCategory(img, state);
  lastGrouped = groups; // CSV用に保持
  renderCounts(groups, lastSort);
}

export function exportCountsCsv() {
  // ★テーブルが未描画ならエラー
  if (!lastRenderedRows || !lastRenderedRows.length) {
    alert("先に画像を変換してください。");
    return;
  }
  const lines = ["category_label,label,count"];
  // ★現在表示されている行をそのままCSVに（順序も一致）
  for (const it of lastRenderedRows) {
    lines.push(
      [safeCsv(it.category_label), safeCsv(it.label), it.count].join(",")
    );
  }
  const csv = lines.join("\n");
  // Excelでも日本語が文字化けしないように BOM を付加
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.download = "counts_grouped_by_block_category.csv";
  a.href = URL.createObjectURL(blob);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

function safeCsv(s) {
  const t = s == null ? "" : String(s);
  // カンマ/改行/ダブルクォートを含む場合はダブルクォートで括る
  if (/[",\n\r]/.test(t)) return `"${t.replaceAll('"', '""')}"`;
  return t;
}
