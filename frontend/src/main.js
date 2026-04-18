import { createApp } from "vue";
import "./style.css";
import RootApp from "./RootApp.vue";
import router from "./router";

router.afterEach((to) => {
  const title = to.meta?.title || "比特币量子风险检测工具";
  const description =
    to.meta?.description || "比特币地址量子风险检测、公钥暴露识别与链上证据追溯。";

  document.title = title;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute("content", description);
});

createApp(RootApp).use(router).mount("#app");
