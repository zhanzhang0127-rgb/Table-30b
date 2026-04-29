import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_core/glm4", () => ({
  invokeGLM4: vi.fn(),
}));

import { invokeGLM4 } from "./_core/glm4";
import { extractPostFromTranscript } from "./_core/voicePostExtractor";

const mockedInvoke = invokeGLM4 as unknown as ReturnType<typeof vi.fn>;

describe("extractPostFromTranscript", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("returns all five fields when transcript is complete", async () => {
    mockedInvoke.mockResolvedValueOnce(
      JSON.stringify({
        title: "海底捞红汤底很正宗",
        content: "今天和朋友去太仓万达的海底捞吃饭，红汤底很正宗。",
        rating: 4,
        restaurantNameHint: "海底捞",
        recommendedDish: "鸭血",
      })
    );
    const result = await extractPostFromTranscript("随便一段语音");
    expect(result.title).toBe("海底捞红汤底很正宗");
    expect(result.rating).toBe(4);
    expect(result.restaurantNameHint).toBe("海底捞");
    expect(result.recommendedDish).toBe("鸭血");
  });

  it("returns rating null when LLM omits a rating", async () => {
    mockedInvoke.mockResolvedValueOnce(
      JSON.stringify({
        title: "校门口拉面",
        content: "中午随便吃了一碗。",
        rating: null,
        restaurantNameHint: "校门口拉面馆",
        recommendedDish: null,
      })
    );
    const result = await extractPostFromTranscript("中午随便吃了一碗");
    expect(result.rating).toBeNull();
    expect(result.recommendedDish).toBeNull();
  });

  it("returns restaurantNameHint null when no store name mentioned", async () => {
    mockedInvoke.mockResolvedValueOnce(
      JSON.stringify({
        title: "今天的午饭",
        content: "随便吃的，没什么特别。",
        rating: 3,
        restaurantNameHint: null,
        recommendedDish: null,
      })
    );
    const result = await extractPostFromTranscript("随便吃的");
    expect(result.restaurantNameHint).toBeNull();
    expect(result.rating).toBe(3);
  });

  it("throws when LLM returns non-JSON", async () => {
    mockedInvoke.mockResolvedValueOnce("这不是 JSON 而是一段普通话");
    await expect(extractPostFromTranscript("xxx")).rejects.toThrow(
      "LLM 返回的不是有效 JSON"
    );
  });

  it("throws when LLM returns JSON without title or content", async () => {
    mockedInvoke.mockResolvedValueOnce(
      JSON.stringify({ title: "", content: "", rating: null })
    );
    await expect(extractPostFromTranscript("xxx")).rejects.toThrow(
      "LLM 未能提取出标题或正文"
    );
  });
});
