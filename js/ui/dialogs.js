import { els } from "./elements.js";
import {
  saveCustomPalette,
  saveGroupWeights,
  saveBlockPrefs,
} from "../storage.js";
import { assembleActivePalette } from "../color/palette.js";

// ===== カスタムパレット編集 =====
export function openPaletteEditor(state) {
  const arr = (state.customPalette?.length ? state.customPalette : []).map(
    ([r, g, b, id, label]) => ({ r, g, b, id, label })
  );
  els.paletteEditor.innerHTML = "";
  if (arr.length === 0)
    addPaletteRow(255, 255, 255, "minecraft:white_wool", "white");
  else arr.forEach((it) => addPaletteRow(it.r, it.g, it.b, it.id, it.label));
  els.paletteDialog.showModal();
}

export function addPaletteRow(r, g, b, id, label) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <input type="number" min="0" max="255" value="${r}">,
    <input type="number" min="0" max="255" value="${g}">,
    <input type="number" min="0" max="255" value="${b}">
    <input type="text" value="${id}">
    <input type="text" value="${label || ""}" placeholder="表示名（任意）">
    <button class="ghost">削除</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  els.paletteEditor.appendChild(row);
}

export function applyPalette(state) {
  const rows = [...els.paletteEditor.querySelectorAll(".row")]
    .map((r) => {
      const ins = r.querySelectorAll("input");
      return [
        parseInt(ins[0].value, 10),
        parseInt(ins[1].value, 10),
        parseInt(ins[2].value, 10),
        String(ins[3].value || "").trim(),
        String(ins[4].value || "").trim(),
      ];
    })
    .filter(
      (a) =>
        Number.isFinite(a[0]) &&
        Number.isFinite(a[1]) &&
        Number.isFinite(a[2]) &&
        a[3]
    );
  state.customPalette = rows.slice(0, 32);
  saveCustomPalette(state.customPalette);

  // UI上のカスタムチェックを強制ON
  const pCustom = document.getElementById("pCustom");
  if (pCustom) pCustom.checked = true;

  assembleActivePalette(state);
  els.paletteDialog.close();
}

// ===== 除外 / 重み設定 =====
export function openPrefDialog(state) {
  els.wWool.value = state.groupWeights.wool ?? 1;
  els.wTerracotta.value = state.groupWeights.terracotta ?? 1;
  els.wConcrete.value = state.groupWeights.concrete ?? 1;
  els.wCustom.value = state.groupWeights.custom ?? 1;

  els.prefTable.innerHTML = "";
  for (const [r, g, b, id, label] of state.activePalette) {
    const pref = state.blockPrefs[id] || { enabled: true, weight: 1 };
    const tr = document.createElement("tr");
    tr.dataset.id = id;
    tr.innerHTML = `
      <td><input type="checkbox" ${pref.enabled !== false ? "checked" : ""}></td>
      <td style="color:rgb(${r},${g},${b});font-weight:700">■</td>
      <td class="mono" style="font-family:monospace">${id}</td>
      <td>${label || ""}</td>
      <td><input type="number" step="0.1" min="0" value="${pref.weight ?? 1}"></td>
    `;
    els.prefTable.appendChild(tr);
  }
  els.prefDialog.showModal();
}

export function applyPrefs(state) {
  state.groupWeights = {
    wool: parseFloat(els.wWool.value) || 1,
    terracotta: parseFloat(els.wTerracotta.value) || 1,
    concrete: parseFloat(els.wConcrete.value) || 1,
    custom: parseFloat(els.wCustom.value) || 1,
  };
  saveGroupWeights(state.groupWeights);

  const prefs = {};
  els.prefTable.querySelectorAll("tr").forEach((tr) => {
    const id = tr.dataset.id;
    const enabled = tr.children[0].querySelector("input").checked;
    const weight = parseFloat(tr.children[4].querySelector("input").value) || 1;
    prefs[id] = { enabled, weight };
  });
  state.blockPrefs = prefs;
  saveBlockPrefs(state.blockPrefs);

  els.prefDialog.close();
}
