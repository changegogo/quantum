<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const searchQuery = ref("");
const activeTheme = ref("全部");
const route = useRoute();
const router = useRouter();
const faqItems = [
  {
    theme: "风险原理",
    q: "什么情况下比特币地址更容易受到量子风险影响？",
    a: "当地址公钥已在链上暴露时（例如地址已有花费记录，或 Taproot 地址输出公钥可直接关联），理论上的量子攻击面会更大。",
  },
  {
    theme: "风险原理",
    q: "风险等级高/中/低代表什么？",
    a: "这是基于地址类型、花费历史、公钥暴露状态和链上活跃度的综合评估，用于风险教育与运维优先级排序，不构成投资建议。",
  },
  {
    theme: "地址与链上行为",
    q: "地址复用为什么会增加风险？",
    a: "地址复用会把多笔资金流长期绑定到同一身份线索，放大链上画像与公钥暴露后的风险范围。",
  },
  {
    theme: "地址与链上行为",
    q: "Taproot（bc1p）地址为什么常被判定更高关注？",
    a: "Taproot 输出与公钥信息强相关，在量子攻击公钥叙事中通常属于更早进入风险关注的地址类型。",
  },
  {
    theme: "操作与迁移",
    q: "为什么建议先小额测试再迁移？",
    a: "小额测试可以验证地址正确性、手续费设置和钱包链路，减少大额一次性转账造成的不可逆损失。",
  },
  {
    theme: "操作与迁移",
    q: "高风险地址迁移时，为什么要分批而不是一次转完？",
    a: "分批迁移能降低单次操作错误导致的损失，并便于逐步校验手续费、到账地址和风控策略是否生效。",
  },
  {
    theme: "证据与数据口径",
    q: "证据链接有什么用途？",
    a: "证据链接会跳转到 Blockstream 或 Mempool 对应交易页面，帮助复核首次暴露与最近活跃等判断，增强可追溯性。",
  },
  {
    theme: "证据与数据口径",
    q: "批量分析里失败地址怎么处理？",
    a: "优先检查地址格式、主网测试网混用、钱包复制是否截断。修复后可再次批量提交，并导出结果留档。",
  },
  {
    theme: "证据与数据口径",
    q: "页面里的余额口径是什么？",
    a: "余额按链上 funded_txo_sum 减去 spent_txo_sum 计算，返回 BTC 与 sats 两种口径。",
  },
  {
    theme: "脚本与多签",
    q: "多签或脚本路径里，脚本暴露后「谁」的公钥算暴露面的一部分？",
    a: "定性说明：当赎回脚本随花费被公开时，脚本中出现的各参与方公钥（以及可按脚本规则关联到的密钥材料）都可能进入「链上可见」范畴，并与对应角色绑定；实际暴露范围取决于脚本类型与本次花费走了哪条路径（例如某条分支是否 reveal 了特定密钥）。本工具只做科普向提示，不能替代对复杂脚本的专业审计或钱包解析。",
  },
  {
    theme: "证据与数据口径",
    q: "测试网和主网会混用吗？使用上要注意什么？",
    a: "当前公开 API 默认按比特币主网解析与查询。请勿把测试网地址与主网地址混在同一批分析里，以免格式或链上查询异常。若你自行部署后端并改用自建节点或其它 BASE URL，请以实际环境变量与节点网络为准。",
  },
  {
    theme: "风险原理",
    q: "风险分偏低是否等于「绝对安全」？",
    a: "不等于。页面分数是在当前公开链上数据与模型假设下的相对评估，用于面向未来的风险教育；量子威胁的时间表、工程可行性与协议演进都有不确定性。低分只表示在当前口径下暴露信号较弱，不是对任何未来场景的担保，更不是「保险箱」式承诺。",
  },
  {
    theme: "证据与数据口径",
    q: "数据从哪里来？为什么不能 100% 还原真实行为？",
    a: "默认通过 Blockstream 等公开区块浏览器 API 获取链上数据（你在后端配置 BLOCKSTREAM_API 或自建索引时，以你的配置为准）。链上只能看到已广播、可索引的交易信息，无法覆盖链下沟通、尚未上链的操作、以及各类隐私增强路径；因此任何基于链上的工具都无法声称对「真实风险」做到完整还原，结论必然存在延迟与盲区。",
  },
];

const filteredFaqItems = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  const source =
    activeTheme.value === "全部"
      ? faqItems
      : faqItems.filter((item) => item.theme === activeTheme.value);
  if (!keyword) return source;
  return source.filter(
    (item) =>
      item.q.toLowerCase().includes(keyword) ||
      item.a.toLowerCase().includes(keyword) ||
      item.theme.toLowerCase().includes(keyword)
  );
});

const themes = computed(() => ["全部", ...new Set(faqItems.map((item) => item.theme))]);

const normalizeTheme = (theme) =>
  themes.value.includes(theme) ? theme : "全部";

const groupedFaqItems = computed(() => {
  const groups = new Map();
  for (const item of filteredFaqItems.value) {
    if (!groups.has(item.theme)) groups.set(item.theme, []);
    groups.get(item.theme).push(item);
  }
  return [...groups.entries()].map(([theme, items]) => ({ theme, items }));
});

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

let schemaNode;
onMounted(() => {
  const initialTheme = route.query.theme;
  const initialQuery = route.query.q;
  activeTheme.value =
    typeof initialTheme === "string" ? normalizeTheme(initialTheme) : "全部";
  searchQuery.value = typeof initialQuery === "string" ? initialQuery : "";

  schemaNode = document.createElement("script");
  schemaNode.type = "application/ld+json";
  schemaNode.text = JSON.stringify(faqJsonLd);
  document.head.appendChild(schemaNode);
});

watch([activeTheme, searchQuery], ([theme, query]) => {
  const normalizedTheme = normalizeTheme(theme);
  if (normalizedTheme !== theme) {
    activeTheme.value = normalizedTheme;
    return;
  }

  const nextQuery = {};
  if (normalizedTheme !== "全部") nextQuery.theme = normalizedTheme;
  if (query.trim()) nextQuery.q = query.trim();

  const currentTheme =
    typeof route.query.theme === "string" ? route.query.theme : undefined;
  const currentQ = typeof route.query.q === "string" ? route.query.q : undefined;

  if (currentTheme === nextQuery.theme && currentQ === nextQuery.q) return;
  router.replace({ query: nextQuery });
});

onUnmounted(() => {
  if (schemaNode && schemaNode.parentNode) {
    schemaNode.parentNode.removeChild(schemaNode);
  }
});
</script>

<template>
  <main class="page">
    <section class="faq-card" aria-label="比特币量子风险常见问题">
      <h1>比特币量子风险 FAQ</h1>
      <input
        v-model="searchQuery"
        class="faq-search"
        type="text"
        placeholder="搜索关键词，例如：Taproot、公钥暴露、迁移"
      />
      <div class="theme-filters">
        <button
          v-for="theme in themes"
          :key="theme"
          class="theme-btn"
          :class="{ active: activeTheme === theme }"
          @click="activeTheme = theme"
        >
          {{ theme }}
        </button>
      </div>

      <div v-for="group in groupedFaqItems" :key="group.theme" class="faq-group">
        <h2>{{ group.theme }}</h2>
        <details v-for="(item, idx) in group.items" :key="item.q" :open="idx === 0">
          <summary>{{ item.q }}</summary>
          <p>{{ item.a }}</p>
        </details>
      </div>

      <p v-if="groupedFaqItems.length === 0" class="pubkey-empty">未找到匹配的 FAQ，请尝试其他关键词。</p>
    </section>
  </main>
</template>
