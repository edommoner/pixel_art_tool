export const els = {
  imageInput: null,
  preview: null,
  outputSize: null,
  cropButton: null,
  downloadButton: null,
  // 追加フィールド
  downloadOrigBtn: null,
  downloadScaledBtn: null,
  resultCanvas: null,
  displayCanvas: null,
  maskCanvas: null,
  exportCountsBtn: null,
  tableBody: null,
  legend: null,
  // palettes (group toggles)
  pWool: null,
  pTerracotta: null,
  pConcrete: null,
  pCustom: null,

  // export
  downloadGuideBtn: null,
  exportPerBlockZip: null,
  exportNbtBtn: null,
  exportMcstructureBtn: null,

  // layer export options
  sortLayersByCount: null,
  layerBg: null,
  layerBgColor: null,

  // dialogs: palette
  editPaletteBtn: null,
  paletteDialog: null,
  paletteEditor: null,
  addColorBtn: null,
  applyPaletteBtn: null,

  // dialogs: prefs
  prefBtn: null,
  prefDialog: null,
  prefTable: null,
  wWool: null,
  wTerracotta: null,
  wConcrete: null,
  wCustom: null,
  applyPrefBtn: null,

  // dev test
  runTestsBtn: null,
  testOut: null,
};

export function initElements() {
  // base
  els.imageInput = document.getElementById("imageInput");
  els.preview = document.getElementById("preview");
  els.outputSize = document.getElementById("outputSize");
  els.cropButton = document.getElementById("cropButton");
  els.downloadButton = document.getElementById("downloadButton");
  // init 内の紐づけ
  els.downloadOrigBtn = document.getElementById("downloadOrigBtn");
  els.downloadScaledBtn = document.getElementById("downloadScaledBtn");
  els.resultCanvas = document.getElementById("resultCanvas");
  els.displayCanvas = document.getElementById("displayCanvas");
  els.maskCanvas = document.getElementById("maskCanvas");
  els.exportCountsBtn = document.getElementById("exportCountsBtn");
  els.tableBody = document.querySelector("#woolTable tbody");
  els.legend = document.getElementById("legend");

  // group toggles
  els.pWool = document.getElementById("pWool");
  els.pTerracotta = document.getElementById("pTerracotta");
  els.pConcrete = document.getElementById("pConcrete");
  els.pCustom = document.getElementById("pCustom");

  // export
  els.downloadGuideBtn = document.getElementById("downloadGuideBtn");
  els.exportPerBlockZip = document.getElementById("exportPerBlockZip");
  els.exportNbtBtn = document.getElementById("exportNbtBtn");
  els.exportMcstructureBtn = document.getElementById("exportMcstructureBtn");

  els.sortLayersByCount = document.getElementById("sortLayersByCount");
  els.layerBg = document.getElementById("layerBg");
  els.layerBgColor = document.getElementById("layerBgColor");

  // dialogs: palette
  els.editPaletteBtn = document.getElementById("editPaletteBtn");
  els.paletteDialog = document.getElementById("paletteDialog");
  els.paletteEditor = document.getElementById("paletteEditor");
  els.addColorBtn = document.getElementById("addColorBtn");
  els.applyPaletteBtn = document.getElementById("applyPaletteBtn");

  // dialogs: prefs
  els.prefBtn = document.getElementById("prefBtn");
  els.prefDialog = document.getElementById("prefDialog");
  els.prefTable = document.querySelector("#prefTable tbody");
  els.wWool = document.getElementById("wWool");
  els.wTerracotta = document.getElementById("wTerracotta");
  els.wConcrete = document.getElementById("wConcrete");
  els.wCustom = document.getElementById("wCustom");
  els.applyPrefBtn = document.getElementById("applyPrefBtn");

  // dev test
  els.runTestsBtn = document.getElementById("runTestsBtn");
  els.testOut = document.getElementById("testOut");
}
