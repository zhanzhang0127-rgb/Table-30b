import { invokeGLM4, type GLM4Message } from "./glm4";

export type ExtractedPost = {
  title: string;
  content: string;
  rating: number | null;
  restaurantNameHint: string | null;
  recommendedDish: string | null;
  cuisine: string | null;
  pricePerPerson: string | null;
};

const SYSTEM_PROMPT = `你是「吃了吗」校园美食社区的发帖整理助手。社区只服务于 XJTLU 太仓校区师生，主张「无商家入驻、无付费推广、只讲真话」。

你的任务：把用户的口语化语音转写文本，整理为结构化帖子草稿。严格遵守以下规则：

1. **保留用户原话的真实感**：不得添加任何夸张、营销或广告口吻（如"必吃"、"yyds"、"地表最强"等）。如果用户的吐槽/差评是负面，必须保留。
2. **title**：≤ 30 个汉字，从用户描述中提炼最有信息量的一句（不是套路化的"美食分享"）。
3. **content**：≤ 500 个汉字，可以分 2-3 段，保留用户原话风格的口语化表达，但去除"嗯"、"啊"、"那个"等无意义口头禅。
4. **rating**：如果用户明确说出分数（如"4 分"、"打 5 星"），返回 1-5 之间的整数；否则返回 null。**不得自己脑补评分。**
5. **restaurantNameHint**：用户提到的店名原文（如"海底捞"、"校门口的兰州拉面"）。如果完全没提，返回 null。
6. **recommendedDish**：用户明确推荐的菜（如"红烧肉很好吃"→"红烧肉"）。没提返回 null。
7. **cuisine**：必须从以下8个类别中选一个最匹配的：面食、火锅、烧烤、小炒家常、日韩料理、西餐快餐、甜品饮品、其他。
8. **pricePerPerson**：根据描述推断人均消费，从以下6档选一个：<¥15、¥15-30、¥30-50、¥50-100、>¥100、不想透露（无法判断时选此项）。

**输出格式**：必须是合法 JSON，7 个字段全部存在。示例：
{"title":"海底捞红汤底很正宗","content":"今天和朋友去太仓万达的海底捞吃饭...","rating":4,"restaurantNameHint":"海底捞","recommendedDish":"鸭血","cuisine":"火锅","pricePerPerson":"¥50-100"}`;

export async function extractPostFromTranscript(
  transcript: string
): Promise<ExtractedPost> {
  const messages: GLM4Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `请整理以下语音转写：\n\n${transcript}` },
  ];

  const raw = await invokeGLM4(messages, {
    temperature: 0.3,
    maxTokens: 1200,
    responseFormat: { type: "json_object" },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("LLM 返回的不是有效 JSON");
  }

  return normalizeExtracted(parsed);
}

function normalizeExtracted(value: unknown): ExtractedPost {
  if (!value || typeof value !== "object") {
    throw new Error("LLM 返回的 JSON 结构不正确");
  }
  const v = value as Record<string, unknown>;

  const title = typeof v.title === "string" ? v.title.trim() : "";
  const content = typeof v.content === "string" ? v.content.trim() : "";
  if (!title || !content) {
    throw new Error("LLM 未能提取出标题或正文");
  }

  let rating: number | null = null;
  if (typeof v.rating === "number" && v.rating >= 1 && v.rating <= 5) {
    rating = Math.round(v.rating);
  }

  const restaurantNameHint =
    typeof v.restaurantNameHint === "string" && v.restaurantNameHint.trim()
      ? v.restaurantNameHint.trim()
      : null;

  const recommendedDish =
    typeof v.recommendedDish === "string" && v.recommendedDish.trim()
      ? v.recommendedDish.trim()
      : null;

  const VALID_CUISINES = new Set(['面食','火锅','烧烤','小炒家常','日韩料理','西餐快餐','甜品饮品','其他']);
  const VALID_PRICE_RANGES = new Set(['<¥15','¥15-30','¥30-50','¥50-100','>¥100','不想透露']);

  const cuisine = typeof v.cuisine === 'string' && VALID_CUISINES.has(v.cuisine)
    ? v.cuisine : null;

  const pricePerPerson = typeof v.pricePerPerson === 'string' && VALID_PRICE_RANGES.has(v.pricePerPerson)
    ? v.pricePerPerson : null;

  return {
    title: title.slice(0, 100),
    content: content.slice(0, 1000),
    rating,
    restaurantNameHint,
    recommendedDish,
    cuisine,
    pricePerPerson,
  };
}
