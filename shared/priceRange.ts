export const PRICE_RANGES = [
  '<¥15',
  '¥15-30',
  '¥30-50',
  '¥50-100',
  '>¥100',
  '不想透露',
] as const;

export type PriceRange = typeof PRICE_RANGES[number];

export const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  '<¥15': '<¥15  外卖经济',
  '¥15-30': '¥15-30  日常午晚餐',
  '¥30-50': '¥30-50  改善伙食',
  '¥50-100': '¥50-100  聚餐',
  '>¥100': '>¥100  奢侈',
  '不想透露': '不想透露',
};

const PRICE_RANGE_LABELS_EN: Record<PriceRange, string> = {
  '<¥15': '<¥15  Budget',
  '¥15-30': '¥15-30  Daily Meals',
  '¥30-50': '¥30-50  Treat Yourself',
  '¥50-100': '¥50-100  Dining Out',
  '>¥100': '>¥100  Splurge',
  '不想透露': 'Prefer not to say',
};

export function getPriceRangeLabel(range: PriceRange, lang: 'zh' | 'en' = 'zh'): string {
  return lang === 'en' ? PRICE_RANGE_LABELS_EN[range] : PRICE_RANGE_LABELS[range];
}
