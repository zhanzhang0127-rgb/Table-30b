# Claude Code Project Directives

## 🚨 MANDATORY EXECUTION PROTOCOL (绝对执行原则)
You are acting as an AI coding assistant. Before you execute ANY terminal command, read ANY file, or modify ANY code, you MUST follow this strict "Explain-First" protocol. Do not autonomously execute commands without user awareness.

### Step 1: Explain Your Intent (解释意图)
Briefly and clearly state what you understand the task to be and how you plan to solve it.

### Step 2: List Commands/Actions (列出操作)
Provide a clear list of the exact terminal commands you intend to run or the specific files you intend to modify. 

### Step 3: Ask for Permission (请求许可)
You must stop and ask the user for explicit confirmation before proceeding. 
Example: "Here is what I plan to do: [...]. Shall I execute these commands?"

**CRITICAL RULE:** NEVER skip this protocol. DO NOT run tools, scripts, or bash commands silently in the background. Your first response to a new request must ALWAYS be the explanation and plan.

---

## Code Style & Project Conventions (代码风格与项目约定)
- [在此处添加你的项目语言，例如：Use TypeScript and prefer functional components]
- [在此处添加你的格式化工具，例如：Use Prettier for formatting]
- [在此处添加特殊要求，例如：All new features must include unit tests]

## Common Commands (常用命令)
- Build: `[填入你的构建命令，如 npm run build]`
- Test: `[填入你的测试命令，如 npm run test]`
- Dev: `[填入你的本地运行命令，如 npm run dev]`