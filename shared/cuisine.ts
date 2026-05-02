export const CUISINES = [
  '面食',
  '火锅',
  '烧烤',
  '小炒家常',
  '日韩料理',
  '西餐快餐',
  '甜品饮品',
  '其他',
] as const;

export type Cuisine = typeof CUISINES[number];

export const CUISINE_LABELS: Record<Cuisine, string> = {
  '面食': '🍜 面食',
  '火锅': '🍲 火锅',
  '烧烤': '🍢 烧烤',
  '小炒家常': '🍱 小炒家常',
  '日韩料理': '🍣 日韩料理',
  '西餐快餐': '🍔 西餐快餐',
  '甜品饮品': '🧋 甜品饮品',
  '其他': '🍽️ 其他',
};
