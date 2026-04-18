import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 开发必须用 `/`，否则 `base: './'` 与 History 路由、模块 URL 冲突，易出现白屏或无法访问
// 构建仍用 `./` 便于相对路径托管（如部分静态站 / 子路径）
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  base: command === "serve" ? "/" : "./",
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
}));
