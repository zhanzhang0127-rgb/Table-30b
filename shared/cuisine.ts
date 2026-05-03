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

const CUISINE_LABELS_EN: Record<Cuisine, string> = {
  '面食': '🍜 Noodles',
  '火锅': '🍲 Hotpot',
  '烧烤': '🍢 BBQ',
  '小炒家常': '🍱 Home Cooking',
  '日韩料理': '🍣 Japanese & Korean',
  '西餐快餐': '🍔 Western & Fast Food',
  '甜品饮品': '🧋 Desserts & Drinks',
  '其他': '🍽️ Other',
};

export function getCuisineLabel(cuisine: Cuisine, lang: 'zh' | 'en' = 'zh'): string {
  return lang === 'en' ? CUISINE_LABELS_EN[cuisine] : CUISINE_LABELS[cuisine];
}
