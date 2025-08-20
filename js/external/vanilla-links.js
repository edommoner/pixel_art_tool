// js/external/vanilla-links.js
const MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"; // 公式一覧
// mcasset.cloud はバージョンごとに GitHubのブランチ/タグを持つミラーです
// （リポのブランチ切り替えで各バージョンにアクセス可能）
// https://github.com/InventivetalentDev/minecraft-assets 参照
function buildLinks(ver) {
  const browse = `https://mcasset.cloud/${encodeURIComponent(ver)}/assets/minecraft/textures/block`;
  const ghPath = `https://github.com/InventivetalentDev/minecraft-assets/tree/${encodeURIComponent(ver)}/assets/minecraft/textures/block`;
  const download = `https://download-directory.github.io/?url=${encodeURIComponent(ghPath)}&filename=vanilla_${encodeURIComponent(ver)}_block_textures`;
  return { browse, download };
}

export async function initVanillaLinks() {
  const sel = document.getElementById("mcVanillaVersion");
  const aBrowse = document.getElementById("linkBrowseTextures");
  const aDownload = document.getElementById("linkDownloadTextures");
  if (!sel || !aBrowse || !aDownload) return;

  // 公式マニフェストから最新版+過去の「release」を取得
  const res = await fetch(MANIFEST_URL);
  const data = await res.json();
  const latest = data?.latest?.release;
  const releases = (data?.versions || []).filter((v) => v.type === "release");

  // 最近の30件程度に絞ってドロップダウンに並べる（必要なら調整）
  const list = releases.slice(0, 30);
  sel.innerHTML = list
    .map((v) => {
      const isLatest = v.id === latest;
      return `<option value="${v.id}" ${isLatest ? "selected" : ""}>${v.id}${isLatest ? " (latest)" : ""}</option>`;
    })
    .join("");

  const apply = () => {
    const ver = sel.value;
    const { browse, download } = buildLinks(ver);
    aBrowse.href = browse;
    aDownload.href = download;
  };
  sel.addEventListener("change", apply);
  apply();
}
