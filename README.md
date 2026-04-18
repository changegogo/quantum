# 比特币量子风险检测工具

一个基于 `Node.js + Vue` 的比特币地址风险分析工具，支持：

- 单地址分析（地址类型、公钥暴露、风险等级、链上证据、余额）
- 批量地址分析（表格、统计、CSV 导出、高风险专属导出）
- 高风险迁移清单（先小额测试、再分批迁移、最终停用）
- 基础 SEO 与可索引内容（首页 + FAQ 页面）

---

## 项目结构

- `backend`：Node.js / Express API
- `frontend`：Vue 3 / Vite 前端

---

## 本地启动

### 1) 启动后端

```bash
cd backend
npm install
npm run dev
```

默认地址：`http://localhost:3000`

### 2) 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://localhost:5173`

---

## SEO 说明（第一版 + 第二版）

已完成：

- 基础 Meta：
  - `title` / `description` / `robots` / `canonical`
  - Open Graph / Twitter Card
- 结构化数据：
  - `WebSite`（首页）
  - `FAQPage`（FAQ 页面）
- 可抓取文件：
  - `frontend/public/robots.txt`
  - `frontend/public/sitemap.xml`
- 可索引页面：
  - `/` 首页
  - `/faq` FAQ 页面（独立路由、独立标题与描述）

---

## 上线前提（必须处理）

上线前请务必完成以下检查：

1. **替换域名**
   - 将以下占位域名替换为你的真实域名：
     - `frontend/index.html` 中的 `https://your-domain.com/`
     - `frontend/public/robots.txt` 中的 `Sitemap` 域名
     - `frontend/public/sitemap.xml` 中的 `<loc>`

2. **确认前后端接口地址**
   - 前端通过 `VITE_API_BASE` 指向后端 API（生产环境不要继续用 localhost）。

3. **重新构建并发布**
   - 执行 `npm run build`（frontend）
   - 发布 `dist` 目录到静态站点/CDN

4. **搜索引擎平台提交**
   - 在 Google Search Console / Bing Webmaster 提交 `sitemap.xml`
   - 验证 `robots.txt` 可访问且语法正确

5. **生产可用性验证**
   - 抽样验证单地址和批量分析
   - 检查证据链接、余额显示、CSV 导出是否正常

---

## 重要说明

- 本工具用于风险教育与运维辅助，不构成投资建议。
- 风险评分与建议是规则化结果，不等于绝对安全结论。
- 对复杂脚本、多签、托管场景，建议结合实际钱包/交易流程复核。


部署express项目
https://github.com/maqi1520/nextjs-tailwind-blog/blob/main/data/blog/%E5%B0%86%20Node%20%E5%BA%94%E7%94%A8%20Express.js%20%E9%83%A8%E7%BD%B2%E5%88%B0%20Vercel.md