import { els } from "./ui/elements.js";
import { saveAs } from "file-saver";

export function updateCountsTable(imageData, state) {
  if (!imageData) return;

  const data = imageData.data;
  const map = new Map(); // id -> {count, rgb, label}
  state.activePalette.forEach(([r, g, b, id, label]) => {
    map.set(id, { count: 0, rgb: [r, g, b], label });
  });

  for (let i = 0; i < data.length; i += 4) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    const p = state.activePalette.find(([r, g, b]) => `${r},${g},${b}` === key);
    if (!p) continue;
    const [r, g, b, id, label] = p;
    const e = map.get(id);
    e.count++;
  }

  els.tableBody.innerHTML = "";
  for (const [id, { count, rgb, label }] of map) {
    if (!count) continue;
    const tr = document.createElement("tr");
    const sw = document.createElement("td");
    sw.className = "sw";
    sw.textContent = "■";
    sw.style.color = `rgb(${rgb.join(",")})`;
    tr.appendChild(sw);
    tr.insertAdjacentHTML(
      "beforeend",
      `<td title="${id}">${label || id}</td><td>${count}</td>`
    );
    els.tableBody.appendChild(tr);
  }
}

export function exportCountsCsv() {
  const rows = [["block_id", "label", "count"]];
  for (const tr of els.tableBody.querySelectorAll("tr")) {
    const label = tr.children[1].textContent;
    const count = tr.children[2].textContent;
    const id = tr.children[1].getAttribute("title") || label;
    rows.push([id, label, count]);
  }
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  saveAs(blob, "mapart_counts.csv");
}
