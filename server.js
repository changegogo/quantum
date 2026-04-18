/** Vercel 若在仓库根目录部署（未设置 Root Directory 为 backend），从此入口加载 Express。 */
export { default } from "./backend/src/server.js";
