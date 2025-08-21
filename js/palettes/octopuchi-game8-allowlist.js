// js/palettes/octopuchi-game8-allowlist.js
// 出典：octopuchi「ブロックカラーチャート」掲載ブロック（例示）
// 分類キーは Game8 の色系統別カテゴリに合わせる
//  - white,yellow,orange,red,pink,purple,blue,green,brown,gray,black,transparent,other
// マッチは日本語名（label）か ID（ids）で行う。必要に応じて増やしてください。

export const OCTOPUCHI_ALLOWLIST = [
  // --- 薄茶→こげ茶（記事L10付近） ---
  {
    label: "灰色のテラコッタ",
    category: "gray",
    ids: ["minecraft:light_gray_terracotta", "minecraft:gray_terracotta"],
  },
  { label: "トウヒの木", category: "brown", ids: ["minecraft:spruce_log"] },
  {
    label: "ダークオークの板材",
    category: "brown",
    ids: ["minecraft:dark_oak_planks"],
  },
  {
    label: "ダークオークの木",
    category: "brown",
    ids: ["minecraft:dark_oak_log"],
  },
  {
    label: "樹皮を剥いだダークオークの木",
    category: "brown",
    ids: ["minecraft:stripped_dark_oak_log"],
  },
  {
    label: "茶色のテラコッタ",
    category: "brown",
    ids: ["minecraft:brown_terracotta"],
  },
  {
    label: "茶色のコンクリート",
    category: "brown",
    ids: ["minecraft:brown_concrete"],
  },
  {
    label: "茶色のシュルカーボックス",
    category: "brown",
    ids: ["minecraft:brown_shulker_box"],
  },
  { label: "茶色の羊毛", category: "brown", ids: ["minecraft:brown_wool"] },
  {
    label: "茶色のコンクリートパウダー",
    category: "brown",
    ids: ["minecraft:brown_concrete_powder"],
  },
  { label: "固めた泥", category: "brown", ids: ["minecraft:packed_mud"] },
  {
    label: "茶色のキノコブロック",
    category: "brown",
    ids: ["minecraft:brown_mushroom_block"],
  },

  // --- 茶→砂（記事L11付近） ---
  {
    label: "マングローブの木",
    category: "brown",
    ids: ["minecraft:mangrove_log"],
  },
  { label: "オークの板材", category: "brown", ids: ["minecraft:oak_planks"] },
  {
    label: "樹皮を剥いだオークの木",
    category: "brown",
    ids: ["minecraft:stripped_oak_log"],
  },
  {
    label: "シラカバの板材",
    category: "brown",
    ids: ["minecraft:birch_planks"],
  },
  {
    label: "樹皮を剥いだシラカバの木",
    category: "brown",
    ids: ["minecraft:stripped_birch_log"],
  },
  { label: "矢細工台", category: "brown", ids: ["minecraft:fletching_table"] },
  {
    label: "滑らかな砂岩",
    category: "brown",
    ids: ["minecraft:smooth_sandstone"],
  },

  // --- オレンジ（記事L11-L12） ---
  {
    label: "橙色のテラコッタ",
    category: "orange",
    ids: ["minecraft:orange_terracotta"],
  },
  {
    label: "アカシアの原木",
    category: "orange",
    ids: ["minecraft:acacia_log"],
  },
  {
    label: "樹皮を剥いだアカシアの木",
    category: "orange",
    ids: ["minecraft:stripped_acacia_log"],
  },
  { label: "テラコッタ", category: "brown", ids: ["minecraft:terracotta"] },
  {
    label: "錆止めされた切り込み入りの銅",
    category: "orange",
    ids: ["minecraft:waxed_cut_copper", "minecraft:waxed_exposed_cut_copper"],
  },
  {
    label: "錆止めされた銅ブロック",
    category: "orange",
    ids: ["minecraft:waxed_copper_block", "minecraft:waxed_exposed_copper"],
  },
  { label: "赤い砂岩", category: "orange", ids: ["minecraft:red_sandstone"] },
  { label: "赤い砂", category: "orange", ids: ["minecraft:red_sand"] },
  {
    label: "橙色のコンクリートパウダー",
    category: "orange",
    ids: ["minecraft:orange_concrete_powder"],
  },
  { label: "橙色の羊毛", category: "orange", ids: ["minecraft:orange_wool"] },

  // --- 黄色（記事L12） ---
  {
    label: "黄色のテラコッタ",
    category: "yellow",
    ids: ["minecraft:yellow_terracotta"],
  },
  {
    label: "ハニカムブロック",
    category: "yellow",
    ids: ["minecraft:honeycomb_block"],
  },
  {
    label: "金の原石ブロック",
    category: "yellow",
    ids: ["minecraft:raw_gold_block"],
  },
  {
    label: "黄色のコンクリート",
    category: "yellow",
    ids: ["minecraft:yellow_concrete"],
  },
  {
    label: "黄色のシュルカーボックス",
    category: "yellow",
    ids: ["minecraft:yellow_shulker_box"],
  },
  { label: "黄色の羊毛", category: "yellow", ids: ["minecraft:yellow_wool"] },
  { label: "金ブロック", category: "yellow", ids: ["minecraft:gold_block"] },
  {
    label: "黄色のコンクリートパウダー",
    category: "yellow",
    ids: ["minecraft:yellow_concrete_powder"],
  },
  {
    label: "黄色の彩釉テラコッタ",
    category: "yellow",
    ids: ["minecraft:yellow_glazed_terracotta"],
  },

  // --- 黄→乳白（装飾）（記事L12） ---
  {
    label: "濡れたスポンジ",
    category: "yellow",
    ids: ["minecraft:wet_sponge"],
  },
  { label: "スポンジ", category: "yellow", ids: ["minecraft:sponge"] },
  { label: "エンドストーン", category: "yellow", ids: ["minecraft:end_stone"] },
  {
    label: "エンドストーンレンガ",
    category: "yellow",
    ids: ["minecraft:end_stone_bricks"],
  },
  { label: "骨", category: "white", ids: ["minecraft:bone_block"] },
  { label: "キノコの柄", category: "white", ids: ["minecraft:mushroom_stem"] },

  // --- 緑→黄緑（記事L12） ---
  {
    label: "緑の彩釉テラコッタ",
    category: "green",
    ids: ["minecraft:green_glazed_terracotta"],
  },
  { label: "スイカ", category: "green", ids: ["minecraft:melon"] },
  {
    label: "黄緑色のコンクリート",
    category: "green",
    ids: ["minecraft:lime_concrete"],
  },
  {
    label: "黄緑色のシュルカーボックス",
    category: "green",
    ids: ["minecraft:lime_shulker_box"],
  },
  { label: "黄緑色の羊毛", category: "green", ids: ["minecraft:lime_wool"] },
  {
    label: "エメラルドブロック",
    category: "green",
    ids: ["minecraft:emerald_block"],
  },
  {
    label: "黄緑色の彩釉テラコッタ",
    category: "green",
    ids: ["minecraft:lime_glazed_terracotta"],
  },
  {
    label: "黄緑色のコンクリートパウダー",
    category: "green",
    ids: ["minecraft:lime_concrete_powder"],
  },
  {
    label: "スライムブロック",
    category: "green",
    ids: ["minecraft:slime_block"],
  },

  // --- 深緑→緑（記事L13） ---
  {
    label: "緑色のテラコッタ",
    category: "green",
    ids: ["minecraft:green_terracotta"],
  },
  {
    label: "緑色のコンクリート",
    category: "green",
    ids: ["minecraft:green_concrete"],
  },
  { label: "苔ブロック", category: "green", ids: ["minecraft:moss_block"] },
  { label: "緑色の羊毛", category: "green", ids: ["minecraft:green_wool"] },
  {
    label: "緑色のコンクリートパウダー",
    category: "green",
    ids: ["minecraft:green_concrete_powder"],
  },
  {
    label: "黄緑糸のテラコッタ",
    category: "green",
    ids: ["minecraft:lime_terracotta"],
  }, // 記事表記ゆれ対策

  // --- 葉（記事L14） -> 緑カテゴリへ ---
  { label: "トウヒの葉", category: "green", ids: ["minecraft:spruce_leaves"] },
  { label: "シラカバの葉", category: "green", ids: ["minecraft:birch_leaves"] },
  {
    label: "マングローブの葉",
    category: "green",
    ids: ["minecraft:mangrove_leaves"],
  },
  {
    label: "ダークオークの葉",
    category: "green",
    ids: ["minecraft:dark_oak_leaves"],
  },
  {
    label: "アカシアの葉",
    category: "green",
    ids: ["minecraft:acacia_leaves"],
  },
  { label: "オークの葉", category: "green", ids: ["minecraft:oak_leaves"] },
  {
    label: "ジャングルの葉",
    category: "green",
    ids: ["minecraft:jungle_leaves"],
  },
  { label: "ツツジの葉", category: "green", ids: ["minecraft:azalea_leaves"] },
];

// Game8 のカテゴリ表示名（UI用）
export const GAME8_COLOR_LABELS_JA = {
  white: "白",
  yellow: "黄",
  orange: "橙",
  red: "赤",
  pink: "ピンク",
  purple: "紫",
  blue: "青",
  green: "緑",
  brown: "茶",
  gray: "灰",
  black: "黒",
  transparent: "透明",
  other: "その他",
};
