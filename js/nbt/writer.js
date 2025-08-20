// writer.lenbt.fixed.js
// Minimal NBT writer for Bedrock (LENBT): all numbers *and string lengths* are Little-Endian.
// Supports: Int, String, List<Int>, List<List<Int>>, List<Compound>, Compound.

class BaseNbtWriter {
  constructor(littleEndian) {
    this.le = !!littleEndian;
  }

  _append(dst, src) {
    for (let i = 0; i < src.length; i++) dst.push(src[i]);
  }

  _u8(n) {
    return [n & 0xff];
  }
  _i32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, n | 0, true);
    return [...b];
  }

  // NOTE: LENBT uses LE for *string length* too
  _u16le(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return [...b];
  }

  _str(s) {
    const u8 = new TextEncoder().encode(s);
    const out = this._u16le(u8.length); // ★ LE length
    for (let i = 0; i < u8.length; i++) out.push(u8[i]);
    return out;
  }

  _i32s(nums) {
    const b = new Uint8Array(nums.length * 4);
    const dv = new DataView(b.buffer);
    for (let i = 0; i < nums.length; i++) dv.setInt32(i * 4, nums[i] | 0, true);
    return [...b];
  }

  _isArrayOfInts(v) {
    return Array.isArray(v) && v.every((n) => Number.isInteger(n));
  }
  _isArrayOfArrayOfInts(v) {
    return (
      Array.isArray(v) &&
      v.length > 0 &&
      v.every((a) => Array.isArray(a) && a.every((n) => Number.isInteger(n)))
    );
  }

  writeNamedCompound(name, obj) {
    const out = [];
    this._append(out, this._u8(10)); // TAG_Compound
    this._append(out, this._str(name || ""));
    this._append(out, this._compoundBody(obj));
    out.push(0); // TAG_End
    return new Uint8Array(out);
  }

  _compoundBody(obj) {
    const out = [];

    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;

      // Int
      if (typeof v === "number" && Number.isInteger(v)) {
        this._append(out, this._u8(3));
        this._append(out, this._str(k));
        this._append(out, this._i32(v));
        continue;
      }

      // String
      if (typeof v === "string") {
        this._append(out, this._u8(8));
        this._append(out, this._str(k));
        this._append(out, this._str(v));
        continue;
      }

      // List types
      if (Array.isArray(v)) {
        // List<List<Int>> (block_indices)
        if (this._isArrayOfArrayOfInts(v)) {
          this._append(out, this._u8(9)); // TAG_List
          this._append(out, this._str(k));
          this._append(out, this._u8(9)); // child = List
          this._append(out, this._i32(v.length));
          for (const inner of v) {
            this._append(out, this._u8(3)); // inner elem = Int
            this._append(out, this._i32(inner.length));
            this._append(out, this._i32s(inner));
          }
          continue;
        }
        // List<Int>
        if (this._isArrayOfInts(v)) {
          this._append(out, this._u8(9));
          this._append(out, this._str(k));
          this._append(out, this._u8(3)); // Int
          this._append(out, this._i32(v.length));
          this._append(out, this._i32s(v));
          continue;
        }
        // List<Compound>
        this._append(out, this._u8(9));
        this._append(out, this._str(k));
        this._append(out, this._u8(10)); // Compound
        this._append(out, this._i32(v.length));
        for (const c of v) {
          this._append(out, this._compoundBody(c));
          out.push(0); // TAG_End of child
        }
        continue;
      }

      // Compound
      if (typeof v === "object") {
        this._append(out, this._u8(10));
        this._append(out, this._str(k));
        this._append(out, this._compoundBody(v));
        out.push(0);
        continue;
      }
    }

    return out;
  }
}

export class NbtWriterJE extends BaseNbtWriter {
  constructor() {
    super(false);
  }
}
export class NbtWriterBE extends BaseNbtWriter {
  constructor() {
    super(true);
  }
}
