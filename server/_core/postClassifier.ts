import { invokeGLM4, type GLM4Message } from "./glm4";

export type ClassificationResult = {
  cuisine: string;
  pricePerPerson: string;
  restaurantHint: string | null;
};

const SYSTEM_PROMPT = `你是「吃了吗」校园美食社区的内容分类助手。

你的任务：根据用户发帖的标题和正文，提取以下结构化信息。

规则：
1. **cuisine**：必须从以下8个类别中选一个最匹配的，不能自造类别：
   面食（拉面/米线/刀削面/水饺等）、火锅（火锅/麻辣烫/串串/冒菜等）、
   烧烤（烧烤/烤肉/烤鱼/铁板等）、小炒家常（快餐/盖浇饭/炒菜/家常菜等）、
   日韩料理（寿司/日式拉面/韩餐/石锅拌饭等）、西餐快餐（汉堡/披萨/意面/轻食/三明治等）、
   甜品饮品（奶茶/咖啡/蛋糕/甜点等）、其他（不明确归类时选此项）
2. **pricePerPerson**：根据描述推断人均消费，从以下6档选一个：
   <¥15、¥15-30、¥30-50、¥50-100、>¥100、不想透露（无法判断时选此项）
3. **restaurantHint**：帖子中提到的店名原文（如"海底捞"、"校门口的拉面"），完全没提则返回 null

**输出格式**：必须是合法 JSON，3个字段全部存在。示例：
{"cuisine":"面食","pricePerPerson":"¥15-30","restaurantHint":"兰州拉面馆"}`;

const FALLBACK: ClassificationResult = {
  cuisine: '其他',
  pricePerPerson: '不想透露',
  restaurantHint: null,
};

const VALID_CUISINES = new Set(['面食','火锅','烧烤','小炒家常','日韩料理','西餐快餐','甜品饮品','其他']);
const VALID_PRICE_RANGES = new Set(['<¥15','¥15-30','¥30-50','¥50-100','>¥100','不想透露']);

export async function classifyPost(
  title: string,
  content: string,
): Promise<ClassificationResult> {
  try {
    const messages: GLM4Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `请分类以下帖子：\n\n标题：${title}\n\n正文：${content}` },
    ];

    const raw = await invokeGLM4(messages, {
      temperature: 0.1,
      maxTokens: 200,
      responseFormat: { type: 'json_object' },
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return FALLBACK;
    }

    if (!parsed || typeof parsed !== 'object') return FALLBACK;
    const v = parsed as Record<string, unknown>;

    const cuisine = typeof v.cuisine === 'string' && VALID_CUISINES.has(v.cuisine)
      ? v.cuisine : '其他';

    const pricePerPerson = typeof v.pricePerPerson === 'string' && VALID_PRICE_RANGES.has(v.pricePerPerson)
      ? v.pricePerPerson : '不想透露';

    const restaurantHint = typeof v.restaurantHint === 'string' && v.restaurantHint.trim()
      ? v.restaurantHint.trim().slice(0, 100) : null;

    return { cuisine, pricePerPerson, restaurantHint };
  } catch {
    return FALLBACK;
  }
}
