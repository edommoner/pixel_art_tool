// js/utils/persist.js
const STORAGE_KEY = "pixel_art_tool.settings.v1";

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeStore(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

// 値の取り出し/適用（型をよしなに）
function getValue(el) {
  const t = (el.type || el.tagName).toLowerCase();
  if (t === "checkbox") return !!el.checked;
  if (t === "number" || t === "range") {
    const n = parseFloat(el.value);
    return Number.isFinite(n) ? n : el.value;
  }
  return el.value;
}
function setValue(el, v) {
  const t = (el.type || el.tagName).toLowerCase();
  if (t === "checkbox") el.checked = !!v;
  else el.value = v;
}

export function initPersistence(root = document) {
  const saved = readStore();
  const controls = Array.from(root.querySelectorAll("[data-persist]"));

  // 1) 復元（UI→状態更新のため change を飛ばす）
  controls.forEach((el) => {
    const k = el.dataset.persist;
    if (saved.hasOwnProperty(k)) {
      setValue(el, saved[k]);
      // 既存のロジックに反応させる
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if (el.type === "range" || el.type === "number" || el.type === "color") {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });

  // 2) 監視して保存（軽いデバウンス）
  let tid = null;
  const saveAll = () => {
    const next = {};
    controls.forEach((el) => (next[el.dataset.persist] = getValue(el)));
    writeStore(next);
  };
  const scheduleSave = () => {
    clearTimeout(tid);
    tid = setTimeout(saveAll, 100);
  };

  controls.forEach((el) => {
    el.addEventListener("change", scheduleSave);
    if (
      el.type === "range" ||
      el.type === "number" ||
      el.type === "text" ||
      el.type === "color"
    ) {
      el.addEventListener("input", scheduleSave);
    }
  });

  // 3) 外から操作できるユーティリティ
  return {
    saveNow: saveAll,
    clear: () => localStorage.removeItem(STORAGE_KEY),
    dump: () => readStore(),
  };
}
