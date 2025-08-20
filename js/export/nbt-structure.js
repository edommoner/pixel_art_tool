import { els } from "../ui/elements.js";
import { DATA_VERSION } from "../constants.js";
import { saveAs } from "file-saver";
import { gzip } from "pako";
import { NbtWriterJE } from "../nbt/writer.js";

// ------ 超軽量 NBT Writer（必要な型のみ） ------
class NbtWriter {
  constructor() {
    this.chunks = [];
  }
  // 書き出し（gzip付き）
  toGzipBuffer(rootName, rootCompound) {
    const raw = this._writeNamedCompound(rootName, rootCompound);
    return gzip(raw);
  }
  // 大きな配列を安全に結合
  _append(dst, src) {
    for (let i = 0; i < src.length; i++) dst.push(src[i]);
  }

  // ---- NBT primitives ----
  _writeNamedCompound(name, value) {
    const w = [];
    this._append(w, this._u8(10)); // TAG_Compound
    this._append(w, this._str(name)); // 名前
    this._append(w, this._compoundBody(value)); // 中身
    w.push(0); // TAG_End
    return new Uint8Array(w);
  }
  _compoundBody(obj) {
    const out = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      if (typeof v === "number") {
        this._append(out, this._u8(3)); // TAG_Int
        this._append(out, this._str(k));
        this._append(out, this._i32(v));
      } else if (typeof v === "string") {
        this._append(out, this._u8(8)); // TAG_String
        this._append(out, this._str(k));
        this._append(out, this._str(v));
      } else if (Array.isArray(v) && v.every((n) => Number.isInteger(n))) {
        // int 配列を List<Int> として扱う（構造物の size/pos 用）
        this._append(out, this._u8(9));
        this._append(out, this._str(k));
        this._append(out, this._u8(3)); // child type: TAG_Int
        this._append(out, this._i32(v.length));
        for (const n of v) this._append(out, this._i32(n));
      } else if (Array.isArray(v)) {
        // List<Compound> 前提（palette, blocks, entities）
        this._append(out, this._u8(9));
        this._append(out, this._str(k));
        this._append(out, this._u8(10)); // child type: TAG_Compound
        this._append(out, this._i32(v.length));
        for (const c of v) {
          this._append(out, this._compoundBody(c));
          out.push(0); // TAG_End for each compound
        }
      } else if (typeof v === "object") {
        this._append(out, this._u8(10));
        this._append(out, this._str(k));
        this._append(out, this._compoundBody(v));
        out.push(0); // TAG_End
      }
    }
    return out;
  }
  // ---- helpers ----
  _u8(n) {
    return [n & 0xff];
  }
  _i16(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setInt16(0, n, false);
    return [...b];
  }
  _i32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, n, false);
    return [...b];
  }
  _str(s) {
    const enc = new TextEncoder();
    const u8 = enc.encode(s);
    const out = this._i16(u8.length);
    for (let i = 0; i < u8.length; i++) out.push(u8[i]);
    return out;
  }
}

// ------ Canvas -> Structure NBT ------
function paletteFromState(state) {
  // state.activePalette: [r,g,b, blockId, label]
  // Structure palette: List<Compound> with "Name": string, "Properties": Compound(省略可)
  return state.activePalette.map((p) => {
    const name = p[3]; // "minecraft:white_wool" 等
    return { Name: name }; // プロパティ未使用
  });
}

function sizeFromCanvas(canvas) {
  // X: width, Y: 1 (平面), Z: height
  return [canvas.width, 1, canvas.height];
}

function blocksFromImage(canvas, state) {
  const sizeX = canvas.width,
    sizeZ = canvas.height;
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, sizeX, sizeZ).data;

  // rgb -> palette index
  const keyToIndex = new Map();
  state.activePalette.forEach((p, i) => {
    keyToIndex.set(`${p[0]},${p[1]},${p[2]}`, i);
  });

  const blocks = [];
  for (let z = 0; z < sizeZ; z++) {
    for (let x = 0; x < sizeX; x++) {
      const idx = (z * sizeX + x) * 4;
      const key = `${data[idx]},${data[idx + 1]},${data[idx + 2]}`;
      const stateIndex = keyToIndex.get(key);
      if (stateIndex === undefined) continue; // 未使用色はスキップ
      blocks.push({
        state: stateIndex,
        pos: [x, 0, z], // yは0固定（平面）
        // "nbt": {} // ブロックエンティティ不要
      });
    }
  }
  return blocks;
}

export function exportStructureNbt(state) {
  const canvas = els.resultCanvas;
  if (!canvas || canvas.width === 0) {
    alert("先に画像を変換してください。");
    return;
  }

  // 構造物ルート
  const struct = {
    DataVersion: DATA_VERSION,
    size: sizeFromCanvas(canvas),
    palette: paletteFromState(state),
    blocks: blocksFromImage(canvas, state),
    entities: [], // なし
  };

  // 書き出し（gzip NBT）
  const writer = new NbtWriterJE(); // ★ Big Endian
  const raw = writer.writeNamedCompound("", struct); // まず生NBT
  const gz = gzip(raw); // ★ gzip圧縮
  const blob = new Blob([gz], { type: "application/octet-stream" });

  // 保存
  const w = canvas.width,
    h = canvas.height;
  saveAs(blob, `mapart_${w}x${h}.nbt`);
}
