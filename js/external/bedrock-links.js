// js/external/bedrock-links.js

const GH_API_BASE =
  "https://api.github.com/repos/Mojang/bedrock-samples/releases?per_page=100";
const FALLBACK = [
  {
    ver: "latest",
    pageUrl: "https://github.com/Mojang/bedrock-samples/releases/latest",
  },
];

// ▼ 追加：アセット名のゆるい判定
function sniffAssetUrl(assets, kind) {
  // kind: 'vrp' or 'vbp'
  const must = ["vanilla"]; // まず "vanilla" を必須
  const any =
    kind === "vrp"
      ? ["resource_pack", "resource-pack", "resource", "vrp"]
      : ["behavior_pack", "behavior-pack", "behavior", "vbp"];
  for (const a of assets || []) {
    const n = (a.name || "").toLowerCase();
    if (!n.endsWith(".zip")) continue;
    if (must.every((k) => n.includes(k)) && any.some((k) => n.includes(k))) {
      return a.browser_download_url;
    }
  }
  return null;
}

// ▼ 変更：アセットが無くてもリリースは採用（ページURLにフォールバック）
function parseReleases(json, { includePre = false } = {}) {
  const out = [];
  for (const rel of json) {
    if (!includePre && rel.prerelease) continue;
    const tag = rel.tag_name || rel.name || "";
    const ver =
      (tag.replace(/^v/i, "") || "").trim() ||
      (rel.name || "").trim() ||
      "unknown";
    const pageUrl = rel.html_url;
    const vrp = sniffAssetUrl(rel.assets, "vrp");
    const vbp = sniffAssetUrl(rel.assets, "vbp");
    out.push({ ver, vrp, vbp, pageUrl, prerelease: !!rel.prerelease });
  }
  return out; // 新しい順のまま
}

// ▼ 変更：0件でも throw しない（latest フォールバックに落ちないように）
async function fetchAllReleases({ includePre = false } = {}) {
  const headers = { Accept: "application/vnd.github+json" };
  const token = localStorage.getItem("ghToken"); // 任意：トークンでレート制限を回避
  if (token) headers.Authorization = `Bearer ${token.trim()}`;

  let page = 1;
  let acc = [];
  while (page <= 3) {
    const url = `${GH_API_BASE}&page=${page}`;
    const res = await fetch(url, { headers });
    if (res.status === 403) throw new Error("rate_limit");
    if (!res.ok) throw new Error("http_" + res.status);
    const json = await res.json();
    acc = acc.concat(json);
    if (!Array.isArray(json) || json.length < 100) break;
    page++;
  }
  // ここで常に配列を返す（0件でもOK）
  return parseReleases(acc, { includePre });
}

export async function initBedrockLinks() {
  const sel = document.getElementById("bedrockVersion");
  const chk = document.getElementById("showPreviews");
  const aVRP = document.getElementById("linkBedrockVRP");
  const aVBP = document.getElementById("linkBedrockVBP");
  const aPage = document.getElementById("linkBedrockReleasePage");
  const status = document.getElementById("bedrockStatus");
  if (!sel || !chk || !aVRP || !aVBP || !aPage) return;

  sel.style.minWidth = "12rem";
  sel.innerHTML = `<option>読み込み中…</option>`;
  if (status) status.textContent = "Bedrock リリースを取得中…";

  let list = [];

  async function reload() {
    try {
      list = await fetchAllReleases({ includePre: chk.checked });

      // 0件ならフォールバック（latest のみ）
      if (!list.length) list = FALLBACK.slice();

      render();
      if (status) status.textContent = `取得: ${list.length} リリース`;
    } catch (e) {
      console.error("[bedrock-links] reload error:", e);
      list = FALLBACK.slice();
      render();
      if (status) {
        status.textContent =
          e.message === "rate_limit"
            ? "GitHub API のレート制限です。数分後に再試行 or GitHubトークンを設定してください。"
            : "取得に失敗しました。最新リリースのみ表示します。";
      }
    }
  }

  function render() {
    sel.innerHTML = list
      .map((it, i) => {
        const label = it.ver + (it.prerelease ? " (preview)" : "");
        return `<option value="${i}" ${i === 0 ? "selected" : ""}>${label}</option>`;
      })
      .join("");
    apply();
  }

  function apply() {
    const idx = Math.max(0, parseInt(sel.value || "0", 10));
    const item = list[idx];
    if (!item) return;
    aVRP.href = item.vrp || item.pageUrl;
    aVRP.textContent = item.vrp
      ? "Vanilla Resource Pack (.zip)"
      : "Vanilla Resource Pack (リリースページへ)";
    aVBP.href = item.vbp || item.pageUrl;
    aVBP.textContent = item.vbp
      ? "Vanilla Behavior Pack (.zip)"
      : "Vanilla Behavior Pack (リリースページへ)";
    aPage.href = item.pageUrl;
  }

  sel.addEventListener("change", apply);
  chk.addEventListener("change", reload);

  await reload();
}
