/**
 * GitHub Pages 项目站：将 index.html 复制为 404.html，
 * 使用户直接打开 /quantum/faq 等路径时仍返回 SPA，由前端路由接管。
 */
import { copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const indexHtml = join(dist, "index.html");
const notFoundHtml = join(dist, "404.html");

if (!existsSync(indexHtml)) {
  console.error("gh-pages-spa-fallback: dist/index.html 不存在，请先执行 vite build");
  process.exit(1);
}

copyFileSync(indexHtml, notFoundHtml);
console.log("已写入 dist/404.html（GitHub Pages SPA 回退）");
