// js/external/bedrock-links.js
const GH_API =
  "https://api.github.com/repos/Mojang/bedrock-samples/releases?per_page=100";

/**
 * GitHub Releases から vX.Y.Z 形式のタグを抽出し、
 * 各リリースの assets から VRP/VBP の直リンクを拾う。
 */
function parseReleases(json, { includePre = false } = {}) {
  const out = [];
  for (const rel of json) {
    // プレビュー(Preview)を除外するかどうか
    if (!includePre && rel.prerelease) continue;

    const tag = rel.tag_name || rel.name || "";
    // 表示名（例：v1.21.100.6 → 1.21.100.6）
    const ver = tag.replace(/^v/i, "");
    const pageUrl = rel.html_url;

    // アセットを探索
    let vrp = null,
      vbp = null;
    for (const a of rel.assets || []) {
      const n = (a.name || "").toLowerCase();
      if (
        !vrp &&
        n.includes("vanilla") &&
        n.includes("resource") &&
        n.endsWith(".zip")
      )
        vrp = a.browser_download_url;
      if (
        !vbp &&
        n.includes("vanilla") &&
        n.includes("behavior") &&
        n.endsWith(".zip")
      )
        vbp = a.browser_download_url;
    }

    // どちらかあるものだけ採用
    if (vrp || vbp)
      out.push({ ver, vrp, vbp, pageUrl, prerelease: !!rel.prerelease });
  }

  // 新しい順のまま返す（GitHubはデフォで降順）
  return out;
}

export async function initBedrockLinks() {
  const sel = document.getElementById("bedrockVersion");
  const chk = document.getElementById("showPreviews");
  const aVRP = document.getElementById("linkBedrockVRP");
  const aVBP = document.getElementById("linkBedrockVBP");
  const aPage = document.getElementById("linkBedrockReleasePage");
  if (!sel || !chk || !aVRP || !aVBP || !aPage) return;

  let list = [];
  async function reload() {
    try {
      const res = await fetch(GH_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error("GitHub API error: " + res.status);
      const json = await res.json();
      list = parseReleases(json, { includePre: chk.checked });

      // ドロップダウン更新
      sel.innerHTML = list
        .map((it, i) => {
          const label = it.ver + (it.prerelease ? " (preview)" : "");
          const selected = i === 0 ? "selected" : "";
          return `<option value="${i}" ${selected}>${label}</option>`;
        })
        .join("");

      apply();
    } catch (e) {
      console.error(e);
      // フォールバック：最新のリリースページ
      sel.innerHTML = `<option>取得失敗</option>`;
      aVRP.removeAttribute("href");
      aVBP.removeAttribute("href");
      aPage.href = "https://github.com/Mojang/bedrock-samples/releases/latest";
    }
  }

  function apply() {
    const idx = parseInt(sel.value, 10);
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
