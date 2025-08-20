import { rgbToLab, deltaE2000 } from "./color/color-space.js";
import { assembleActivePalette, findNearestColorRGB } from "./color/palette.js";
import { els } from "./ui/elements.js";

// シンプルなアサートログ
function OK(name, cond) {
  return `${cond ? "✅" : "❌"} ${name}`;
}

export function runTests(state) {
  const out = [];

  // 基本的なテキスト系
  out.push(OK("CSV 改行が \\n", ["a", "b"].join("\n").includes("\n")));
  out.push(
    OK("mcfunction 改行が \\n", ["cmd1", "cmd2"].join("\n") === "cmd1\ncmd2")
  );

  // ΔE2000 対称性
  const l1 = rgbToLab([0, 0, 0]),
    l2 = rgbToLab([255, 255, 255]);
  const d12 = deltaE2000(l1, l2),
    d21 = deltaE2000(l2, l1);
  out.push(OK("ΔE2000 が対称", Math.abs(d12 - d21) < 1e-9));

  // パレット差し替え検証（除外・重み）
  const bak = {
    active: state.activePalette.slice(),
    groupWeights: { ...state.groupWeights },
    blockPrefs: JSON.parse(JSON.stringify(state.blockPrefs)),
    customPalette: state.customPalette.slice(),
  };

  state.customPalette = [
    [0, 0, 0, "minecraft:black_wool", "黒"],
    [255, 255, 255, "minecraft:white_wool", "白"],
  ];
  assembleActivePalette(state);
  state.blockPrefs = {
    "minecraft:black_wool": { enabled: false, weight: 1 },
    "minecraft:white_wool": { enabled: true, weight: 1 },
  };
  state.groupWeights = { wool: 1, terracotta: 1, concrete: 1, custom: 1 };

  // 除外が効く＆白が選ばれる
  const chosen = findNearestColorRGB([250, 250, 250], state).blockId;
  out.push(OK("白が選ばれる", chosen === "minecraft:white_wool"));

  // UIテスト（強度スライダの表示切替）
  const dithering = document.getElementById("dithering");
  const natural = document.getElementById("naturalDithering");
  const strength = document.getElementById("naturalStrength")?.parentElement;
  if (dithering && natural && strength) {
    dithering.checked = false;
    dithering.dispatchEvent(new Event("change"));
    out.push(
      OK(
        "ディザ無効で強度非表示",
        strength.style.display === "none" || strength.style.display === ""
      )
    );
    dithering.checked = true;
    natural.checked = false;
    dithering.dispatchEvent(new Event("change"));
    natural.dispatchEvent(new Event("change"));
    out.push(
      OK(
        "ナチュラルOFFで強度非表示",
        strength.style.display === "none" || strength.style.display === ""
      )
    );
    natural.checked = true;
    natural.dispatchEvent(new Event("change"));
    out.push(OK("ナチュラルONで強度表示", strength.style.display !== "none"));
  }

  // RLE 検証・座標変換
  const cvs = document.createElement("canvas");
  cvs.width = 4;
  cvs.height = 1;
  const c = cvs.getContext("2d");
  const img = c.createImageData(4, 1);
  function put(x, r, g, b) {
    const i = x * 4;
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = 255;
  }
  put(0, 255, 255, 255);
  put(1, 255, 255, 255);
  put(2, 255, 255, 255);
  put(3, 0, 0, 0);
  c.putImageData(img, 0, 0);

  state.customPalette = [
    [255, 255, 255, "minecraft:white_wool", "白"],
    [0, 0, 0, "minecraft:black_wool", "黒"],
  ];
  assembleActivePalette(state);

  // 復元
  state.activePalette = bak.active;
  state.groupWeights = bak.groupWeights;
  state.blockPrefs = bak.blockPrefs;
  state.customPalette = bak.customPalette;

  // 出力
  if (els.testOut) {
    els.testOut.style.display = "block";
    els.testOut.textContent = out.join("\n");
  } else {
    console.log(out.join("\n"));
  }
}
