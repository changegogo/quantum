import { createRouter, createWebHistory } from "vue-router";
import HomePage from "./App.vue";
import FaqPage from "./pages/FaqPage.vue";
import TrustPage from "./pages/TrustPage.vue";
import MethodologyPage from "./pages/MethodologyPage.vue";

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
  {
    path: "/trust",
    component: TrustPage,
    meta: {
      title: "合规与信任 | 免责声明与隐私说明",
      description:
        "比特币量子风险检测工具的免责声明、非投资建议说明、开源仓库与隐私数据处理说明。",
    },
  },
  {
    path: "/methodology",
    component: MethodologyPage,
    meta: {
      title: "模型说明与方法论 | 风险分口径与局限",
      description:
        "比特币量子风险检测工具的风险分计算说明、公开链上数据局限、量子风险极简科普与常见误解澄清。",
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
