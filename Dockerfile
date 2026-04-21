FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.4.1

# Copy dependency files first for better layer caching
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# 使用国内镜像加速下载
RUN pnpm config set registry https://registry.npmmirror.com

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build frontend (Vite) + backend (esbuild)
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js"]
