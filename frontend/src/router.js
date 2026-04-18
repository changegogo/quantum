import { createRouter, createWebHistory } from "vue-router";
import HomePage from "./App.vue";
import FaqPage from "./pages/FaqPage.vue";

const routes = [
  {
    path: "/",
    component: HomePage,
    meta: {
      title: "比特币量子风险检测工具 | 地址公钥暴露与迁移建议",
      description:
        "免费查询比特币地址类型、公钥是否暴露、量子风险等级、链上证据与迁移清单，支持单地址和批量分析。",
    },
  },
  {
    path: "/faq",
    component: FaqPage,
    meta: {
      title: "比特币量子风险 FAQ | 公钥暴露、迁移与防护建议",
      description:
        "了解比特币量子风险常见问题：公钥暴露条件、风险等级含义、迁移步骤与证据追溯方法。",
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
