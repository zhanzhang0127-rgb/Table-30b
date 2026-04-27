import { describe, it, expect } from "vitest";
import axios from "axios";

describe("GLM-4 API Key validation", () => {
  it("should successfully call GLM-4 API with the configured key", async () => {
    const apiKey = process.env.GLM4_API_KEY;
    expect(apiKey, "GLM4_API_KEY must be set").toBeTruthy();

    const response = await axios.post(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      {
        model: "glm-4-flash",
        messages: [{ role: "user", content: "你好，请回复「测试成功」" }],
        max_tokens: 20,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.choices).toBeDefined();
    expect(response.data.choices[0].message.content).toBeTruthy();
    console.log("GLM-4 response:", response.data.choices[0].message.content);
  }, 20000);
});
