import axios from "axios";
import { ENV } from "./env";

const GLM4_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM4_MODEL = "glm-4-flash";

export interface GLM4Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GLM4Response {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 调用 GLM-4 API 进行对话
 * API Key 仅在服务端使用，不会暴露给前端
 */
export async function invokeGLM4(
  messages: GLM4Message[],
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  if (!ENV.glm4ApiKey) {
    throw new Error("GLM4_API_KEY 未配置");
  }

  const response = await axios.post<GLM4Response>(
    GLM4_API_URL,
    {
      model: GLM4_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1500,
    },
    {
      headers: {
        Authorization: `Bearer ${ENV.glm4ApiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const content = response.data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("GLM-4 返回了空响应");
  }
  return content;
}
