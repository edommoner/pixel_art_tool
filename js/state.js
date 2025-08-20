export const state = {
  cropper: null,

  customPalette: [],
  activePalette: [],
  paletteSnapshot: [], // ★ 量子化時に固定コピーを保存
  groupOfId: new Map(),
  groupWeights: { wool: 1, terracotta: 1, concrete: 1, custom: 1 },
  blockPrefs: {},

  paletteLab: [],
  labCache: new Map(),
};
