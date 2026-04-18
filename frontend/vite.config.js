import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 开发：base 为 `/`。生产构建：GitHub Pages 项目站路径为 `/quantum/`（与仓库名一致）。
// 勿再用 Hash 路由（#/），否则搜索引擎通常只收录首页；应用 History + 404.html 回退。
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  base: command === "build" ? "/quantum/" : "/",
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
}));
