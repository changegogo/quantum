<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";

const apiBase = import.meta.env.VITE_API_BASE || "https://coingoto.vercel.app";

const CHECKLIST_STORAGE_KEY = "btc-migration-checklist-v1";

const migrationSteps = [
  {
    key: "smokeTest",
    title: "小额测试",
    detail: "先从待迁移地址向新地址转一笔小额 BTC，确认到账、手续费与钱包流程无误后再加大金额。",
  },
  {
    key: "batchMigrate",
    title: "分批迁移",
    detail: "大额资产拆成多笔转账，每笔确认链上到账后再继续，降低单次操作失误带来的损失面。",
  },
  {
    key: "retireOld",
    title: "停用旧地址",
    detail: "迁移完成后停止向旧地址收款，更新所有对外收款入口（网页、二维码、记账习惯）。",
  },
  {
    key: "backupVerify",
    title: "备份验证",
    detail: "确认助记词或备份介质可用且妥善保管；勿截图、勿明文保存在网盘或聊天工具中。",
  },
];

const walletHabits = [
  "收款尽量使用新地址，减少长期复用带来的链上关联与暴露面放大。",
  "长期大额优先考虑冷存储或独立硬件类方案（按自身风险承受能力选择具体形态）。",
  "勿在聊天、邮件或截图中传播完整地址与助记词；留意剪贴板劫持与钓鱼页面。",
  "定期抽查备份是否仍可恢复，并避免在联网环境下输入完整助记词。",
];

const checklistState = ref({
  smokeTest: false,
  batchMigrate: false,
  retireOld: false,
  backupVerify: false,
});

onMounted(() => {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    checklistState.value = { ...checklistState.value, ...parsed };
  } catch {
    /* ignore */
  }
});

watch(
  checklistState,
  (v) => {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
  { deep: true }
);

function printActionGuide() {
  window.print();
}

function resetChecklist() {
  checklistState.value = {
    smokeTest: false,
    batchMigrate: false,
    retireOld: false,
    backupVerify: false,
  };
  try {
    localStorage.removeItem(CHECKLIST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const address = ref("");
const loading = ref(false);
const error = ref("");
const result = ref(null);
const resultCardRef = ref(null);
const batchInput = ref("");
const batchLoading = ref(false);
const batchError = ref("");
const batchResult = ref(null);
const addressKnowledge = [
  {
    type: "P2PKH（1 开头）",
    science:
      "最早期、最常见的单签地址。收款阶段链上只有公钥哈希，真正花费时会在解锁脚本中公开完整公钥。",
    risk:
      "一旦地址出现花费行为，公钥会暴露。若未来容错量子计算机可行，历史暴露公钥对应资金可能面临额外风险。",
  },
  {
    type: "P2SH（3 开头）",
    science:
      "脚本哈希地址，常用于多签或兼容 SegWit 的包裹地址。链上先看到脚本哈希，花费时公开赎回脚本。",
    risk:
      "花费后可能暴露脚本细节和其中公钥（例如多签参与方公钥），复杂脚本的暴露面通常高于普通单签。",
  },
  {
    type: "P2WPKH / P2WSH（bc1q 开头）",
    science:
      "原生 SegWit 地址。交易体积更小、手续费更低。与传统地址类似，通常在花费输入见证数据中出现公钥或脚本。",
    risk:
      "未花费前暴露较少，花费后会进入“已公开关键信息”状态；长期复用同一地址会扩大可关联与被分析范围。",
  },
  {
    type: "P2TR（bc1p 开头，Taproot）",
    science:
      "Taproot 地址采用 Schnorr 方案与新脚本路径设计，提升隐私和表达能力。输出承诺本身与公钥信息强相关。",
    risk:
      "通常可视作天然更早暴露公钥信息。虽然具备其他隐私优势，但在“量子攻击公钥”叙事里不代表绝对安全。",
  },
];

const exposureText = computed(() => {
  if (!result.value) return "";
  return result.value.publicKeyExposed ? "是（已暴露）" : "否（暂未暴露）";
});

function formatDateTime(isoString) {
  if (!isoString) return "暂无数据";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "暂无数据";
  return date.toLocaleString("zh-CN", { hour12: false });
}

const timelineRows = computed(() => {
  if (!result.value?.riskTimeline) return [];
  return [
    {
      label: "首次花费时间",
      value: formatDateTime(result.value.riskTimeline.firstSpentAt),
      hint: "首次从该地址花费 UTXO 的时间点。",
    },
    {
      label: "首次公钥暴露时间",
      value: formatDateTime(result.value.riskTimeline.firstPublicKeyExposedAt),
      hint: "首次可认为已在链上暴露公钥相关信息的时间点。",
    },
    {
      label: "最近活跃时间",
      value: formatDateTime(result.value.riskTimeline.recentActiveAt),
      hint: "最近一次收款或花费被记录的时间。",
    },
  ];
});

const evidenceRows = computed(() => {
  const evidence = result.value?.riskTimeline?.evidence;
  if (!evidence) return [];
  return [
    { label: "首次花费证据", tx: evidence.firstSpentTx },
    { label: "首次公钥暴露证据", tx: evidence.firstPublicKeyExposedTx },
    { label: "最近活跃证据", tx: evidence.recentActiveTx },
  ];
});

const batchSummaryNarrative = computed(() => {
  const s = batchResult.value?.summary;
  if (!s) return "";

  const req = s.totalRequested ?? 0;
  const processed = s.totalProcessed ?? 0;
  const ok = s.successCount ?? 0;
  const fail = s.failedCount ?? 0;
  const hi = s.highRiskCount ?? 0;
  const mid = s.mediumRiskCount ?? 0;
  const low = s.lowRiskCount ?? 0;
  const avg = s.averageRiskScore ?? 0;

  const segments = [];
  segments.push(
    `本次共提交 ${req} 个地址，实际参与分析 ${processed} 个；成功返回 ${ok} 个${fail ? `，失败 ${fail} 个（请核对地址格式或稍后重试）` : ""}。`
  );

  if (ok <= 0) return segments.join(" ");

  segments.push(
    `在成功样本中：高风险 ${hi} 个、中风险 ${mid} 个、低风险 ${low} 个；平均风险分为 ${avg} 分（0–100，分值越高通常表示越应优先关注迁移与地址轮换）。`
  );

  if (hi > 0) {
    segments.push(
      "建议优先处理高风险地址：采用下方「迁移检查清单」的顺序，先小额试转再分批迁移，并在完成后停用旧收款入口。"
    );
  } else if (mid > 0) {
    segments.push(
      "整体存在一定暴露信号，建议减少地址复用、持续观察链上行为，并按习惯清单逐步收紧收款方式。"
    );
  } else {
    segments.push(
      "当前样本整体信号相对温和，但仍建议保持良好收款习惯并定期复查；量子风险属于长期议题，重在持续管理而非一次性结论。"
    );
  }

  return segments.join("");
});

const riskLevel = computed(() => {
  if (!result.value) return null;

  const spentTxo = result.value.onChainStats?.spentTxoCount || 0;
  const isTaproot = result.value.addressType?.startsWith("P2TR");
  const exposed = result.value.publicKeyExposed;

  let score = 25;
  if (exposed) score += 45;
  if (spentTxo > 0) score += 20;
  if (isTaproot) score += 10;
  score = Math.min(score, 100);

  if (score >= 75) {
    return {
      label: "高",
      className: "risk-high",
      score,
      scenario: "地址已进入较高关注状态，建议尽快评估迁移与地址轮换策略。",
    };
  }
  if (score >= 45) {
    return {
      label: "中",
      className: "risk-medium",
      score,
      scenario: "存在部分暴露因素，建议减少复用并关注后续链上行为。",
    };
  }
  return {
    label: "低",
    className: "risk-low",
    score,
    scenario: "当前暴露信号较少，但仍建议遵循最佳实践并持续监控。",
  };
});

const readinessLevelMap = {
  high: "高",
  medium: "中",
  low: "低",
};

const quantumStage = {
  now: "目前仍处于“研究与原型验证”阶段，尚无公开证据显示量子计算机可在现实时间内批量破解比特币私钥。",
  principle:
    "理论上，若存在足够规模、低错误率的容错量子计算机，可用 Shor 算法加速离散对数求解，从公开公钥反推私钥。",
  keyPoint:
    "风险触发前提是“公钥已公开”。因此减少地址复用、减少公钥暴露窗口，是当下最有效的实务防线。",
};
const quantumReferences = [
  { name: "NIST Post-Quantum Cryptography 项目", url: "https://csrc.nist.gov/projects/post-quantum-cryptography" },
  { name: "Bitcoin Wiki: Secp256k1", url: "https://en.bitcoin.it/wiki/Secp256k1" },
  { name: "BIP 提案仓库（协议升级参考）", url: "https://github.com/bitcoin/bips" },
  { name: "Shor 算法（百科综述）", url: "https://en.wikipedia.org/wiki/Shor%27s_algorithm" },
];

async function analyzeAddress() {
  if (!address.value.trim()) {
    error.value = "请输入比特币地址";
    result.value = null;
    return;
  }

  loading.value = true;
  error.value = "";
  result.value = null;

  try {
    const response = await fetch(
      `${apiBase}/api/address/${encodeURIComponent(address.value.trim())}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.error || "请求失败");
    }

    result.value = data;
    await nextTick();
    resultCardRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    error.value = err.message || "请求失败，请稍后重试";
  } finally {
    loading.value = false;
  }
}

async function analyzeBatchAddresses() {
  const addresses = batchInput.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (addresses.length === 0) {
    batchError.value = "请至少输入 1 个地址（每行一个）";
    batchResult.value = null;
    return;
  }

  batchLoading.value = true;
  batchError.value = "";
  batchResult.value = null;

  try {
    const response = await fetch(`${apiBase}/api/address/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.error || "批量请求失败");
    }
    batchResult.value = data;
  } catch (err) {
    batchError.value = err.message || "批量请求失败，请稍后重试";
  } finally {
    batchLoading.value = false;
  }
}

function exportBatchCsv() {
  if (!batchResult.value?.results?.length) return;

  const header = [
    "address",
    "addressType",
    "riskLevel",
    "riskScore",
    "publicKeyExposed",
    "confidence",
    "txCount",
    "spentTxoCount",
    "quantumReadinessLevel",
    "quantumReadinessScore",
  ];
  const rows = batchResult.value.results.map((item) => [
    item.address,
    item.addressType,
    item.remediationAdvice?.level || "",
    item.remediationAdvice?.riskScore ?? "",
    item.publicKeyExposed ? "true" : "false",
    item.confidence || "",
    item.onChainStats?.txCount ?? 0,
    item.onChainStats?.spentTxoCount ?? 0,
    item.quantumReadiness?.level || "",
    item.quantumReadiness?.score ?? "",
  ]);
  const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csvText = [header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const now = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  const a = document.createElement("a");
  a.href = url;
  a.download = `btc-batch-risk-${now}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportHighRiskCsv() {
  const highRiskResults =
    batchResult.value?.results?.filter((item) => item?.remediationAdvice?.level === "high") || [];
  if (highRiskResults.length === 0) {
    batchError.value = "当前无高风险地址可导出。";
    return;
  }

  const header = [
    "address",
    "addressType",
    "riskLevel",
    "riskScore",
    "publicKeyExposed",
    "confidence",
    "txCount",
    "spentTxoCount",
    "recentEvidenceTxid",
    "recentEvidenceBlockstream",
    "recentEvidenceMempool",
    "migrationStep1",
    "migrationStep2",
    "migrationStep3",
  ];

  const rows = highRiskResults.map((item) => {
    const migration = item.remediationAdvice?.migrationChecklist || [];
    const recentTx = item.riskTimeline?.evidence?.recentActiveTx;
    return [
      item.address,
      item.addressType,
      item.remediationAdvice?.level || "",
      item.remediationAdvice?.riskScore ?? "",
      item.publicKeyExposed ? "true" : "false",
      item.confidence || "",
      item.onChainStats?.txCount ?? 0,
      item.onChainStats?.spentTxoCount ?? 0,
      recentTx?.txid || "",
      recentTx?.blockstream || "",
      recentTx?.mempool || "",
      migration[0]?.detail || "",
      migration[1]?.detail || "",
      migration[2]?.detail || "",
    ];
  });

  const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csvText = [header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const now = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  const a = document.createElement("a");
  a.href = url;
  a.download = `btc-high-risk-only-${now}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="page">
    <div class="no-print">
    <h1>比特币地址量子风险检测</h1>
    <p class="intro">
      输入地址后可识别地址类型，并基于链上花费行为判断该地址公钥是否已经暴露。
      <router-link class="intro-method-link" to="/methodology">模型说明与方法论（风险分口径）</router-link>
    </p>

    <div class="form-card">
      <input
        v-model="address"
        class="address-input"
        type="text"
        placeholder="例如：1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
      />
      <button class="analyze-btn" :disabled="loading" @click="analyzeAddress">
        {{ loading ? "分析中..." : "开始分析" }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="result" ref="resultCardRef" class="result-card">
      <h2>分析结果</h2>
      <div class="risk-visual">
        <p class="risk-line">
          <strong>地址风险等级：</strong>
          <span class="risk-badge" :class="riskLevel.className">{{ riskLevel.label }}</span>
          <span class="risk-score">风险分 {{ riskLevel.score }}/100</span>
        </p>
        <div class="risk-bar-track">
          <div
            class="risk-bar-fill"
            :class="riskLevel.className"
            :style="{ width: `${riskLevel.score}%` }"
          ></div>
        </div>
        <p class="risk-scene"><strong>场景解读：</strong>{{ riskLevel.scenario }}</p>
      </div>
      <p><strong>地址：</strong>{{ result.address }}</p>
      <p><strong>地址类型：</strong>{{ result.addressType }}</p>
      <p>
        <strong>公钥是否暴露：</strong>
        <span :class="result.publicKeyExposed ? 'status-danger' : 'status-safe'">
          {{ exposureText }}
        </span>
      </p>
      <div class="timeline-box">
        <strong>风险时间线：</strong>
        <ul class="timeline-list">
          <li v-for="item in timelineRows" :key="item.label">
            <p class="timeline-main">{{ item.label }}：{{ item.value }}</p>
            <p class="timeline-hint">{{ item.hint }}</p>
          </li>
        </ul>
      </div>
      <div class="evidence-box">
        <strong>来源交易链接：</strong>
        <ul class="evidence-list">
          <li v-for="item in evidenceRows" :key="item.label">
            <span class="evidence-label">{{ item.label }}：</span>
            <span v-if="item.tx">
              <a :href="item.tx.blockstream" target="_blank" rel="noopener noreferrer">Blockstream</a>
              <span> / </span>
              <a :href="item.tx.mempool" target="_blank" rel="noopener noreferrer">Mempool</a>
            </span>
            <span v-else class="pubkey-empty">暂无</span>
          </li>
        </ul>
      </div>
      <p><strong>公钥提取状态：</strong>{{ result.publicKeyHint }}</p>
      <div class="pubkey-box">
        <strong>地址公钥：</strong>
        <ul v-if="result.publicKeys && result.publicKeys.length > 0" class="pubkey-list">
          <li v-for="key in result.publicKeys" :key="key">
            <code>{{ key }}</code>
          </li>
        </ul>
        <p v-else class="pubkey-empty">暂无可展示公钥</p>
      </div>
      <p><strong>判断置信度：</strong>{{ result.confidence }}</p>
      <p><strong>说明：</strong>{{ result.explanation }}</p>
      <p><strong>交易笔数：</strong>{{ result.onChainStats.txCount }}</p>
      <p>
        <strong>地址余额：</strong>{{ result.onChainStats.balanceBtc }} BTC
        <span class="sats-text">（{{ result.onChainStats.balanceSats }} sats）</span>
      </p>
      <p><strong>已花费 UTXO 数：</strong>{{ result.onChainStats.spentTxoCount }}</p>
      <p><strong>提示：</strong>{{ result.warning }}</p>
    </div>

    <div class="batch-card">
      <h2>批量地址检测</h2>
      <p class="education-intro">每行输入 1 个地址，最多处理 30 个地址。</p>
      <textarea
        v-model="batchInput"
        class="batch-input"
        rows="5"
        placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa&#10;bc1p..."
      ></textarea>
      <button class="analyze-btn" :disabled="batchLoading" @click="analyzeBatchAddresses">
        {{ batchLoading ? "批量分析中..." : "开始批量分析" }}
      </button>
      <p v-if="batchError" class="error">{{ batchError }}</p>

      <div v-if="batchResult" class="batch-result">
        <p>
          <strong>汇总：</strong>成功 {{ batchResult.summary.successCount }} / 失败
          {{ batchResult.summary.failedCount }}，高/中/低风险：
          {{ batchResult.summary.highRiskCount }}/{{ batchResult.summary.mediumRiskCount }}/{{
            batchResult.summary.lowRiskCount
          }}，平均风险分 {{ batchResult.summary.averageRiskScore }}
        </p>
        <p v-if="batchSummaryNarrative" class="batch-narrative">{{ batchSummaryNarrative }}</p>
        <div class="export-actions">
          <button class="export-btn" @click="exportBatchCsv">导出 CSV</button>
          <button class="export-btn danger" @click="exportHighRiskCsv">仅导出高风险 CSV</button>
        </div>
        <div class="batch-table-wrap">
          <table class="batch-table">
            <thead>
              <tr>
                <th>地址</th>
                <th>类型</th>
                <th>风险等级</th>
                <th>风险分</th>
                <th>公钥暴露</th>
                <th>余额(BTC)</th>
                <th>证据</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in batchResult.results" :key="item.address">
                <td class="mono-cell">{{ item.address }}</td>
                <td>{{ item.addressType }}</td>
                <td>
                  <span
                    :class="
                      item.remediationAdvice.level === 'low'
                        ? 'status-safe'
                        : item.remediationAdvice.level === 'high'
                          ? 'status-danger'
                          : 'status-warn'
                    "
                  >
                    {{ item.remediationAdvice.level }}
                  </span>
                </td>
                <td>{{ item.remediationAdvice.riskScore }}</td>
                <td>
                  <span :class="item.publicKeyExposed ? 'status-danger' : 'status-safe'">
                    {{ item.publicKeyExposed ? "是" : "否" }}
                  </span>
                </td>
                <td>{{ item.onChainStats?.balanceBtc ?? 0 }}</td>
                <td>
                  <span v-if="item.riskTimeline?.evidence?.recentActiveTx">
                    <a
                      :href="item.riskTimeline.evidence.recentActiveTx.blockstream"
                      target="_blank"
                      rel="noopener noreferrer"
                      >B</a
                    >
                    <span>/</span>
                    <a
                      :href="item.riskTimeline.evidence.recentActiveTx.mempool"
                      target="_blank"
                      rel="noopener noreferrer"
                      >M</a
                    >
                  </span>
                  <span v-else class="pubkey-empty">暂无</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="result?.remediationAdvice" class="advice-card">
      <h2>量子高风险整改建议</h2>
      <p class="advice-summary">
        <strong>建议等级：</strong>
        <span class="risk-badge" :class="`risk-${result.remediationAdvice.level}`">
          {{ result.remediationAdvice.level === "high" ? "高" : result.remediationAdvice.level === "medium" ? "中" : "低" }}
        </span>
        <span class="risk-score">风险分 {{ result.remediationAdvice.riskScore }}/100</span>
      </p>
      <p class="advice-text">{{ result.remediationAdvice.summary }}</p>
      <ul class="advice-list">
        <li v-for="item in result.remediationAdvice.actions" :key="item">{{ item }}</li>
      </ul>
      <div v-if="result.remediationAdvice.migrationChecklist?.length" class="migration-box">
        <p class="migration-title"><strong>钱包迁移分步清单</strong></p>
        <ol class="migration-list">
          <li v-for="step in result.remediationAdvice.migrationChecklist" :key="step.step">
            <p class="migration-step-title">第 {{ step.step }} 步：{{ step.title }}</p>
            <p class="migration-step-detail">{{ step.detail }}</p>
          </li>
        </ol>
      </div>
    </div>

    <div v-if="result?.quantumReadiness" class="readiness-card">
      <h2>抗量子准备度评分</h2>
      <p class="advice-summary">
        <strong>准备度等级：</strong>
        <span class="risk-badge" :class="`risk-${result.quantumReadiness.level}`">
          {{ readinessLevelMap[result.quantumReadiness.level] || "低" }}
        </span>
        <span class="risk-score">准备度 {{ result.quantumReadiness.score }}/100</span>
      </p>
      <p class="advice-text">{{ result.quantumReadiness.summary }}</p>
      <ul class="readiness-list">
        <li
          v-for="check in result.quantumReadiness.checks"
          :key="check.key"
          :class="check.passed ? 'check-pass' : 'check-fail'"
        >
          {{ check.passed ? "✓" : "✗" }} {{ check.title }}（权重 {{ check.impact }}）
        </li>
      </ul>
      <p v-if="result.quantumReadiness.blockers?.length" class="blockers">
        <strong>当前短板：</strong>{{ result.quantumReadiness.blockers.join("、") }}
      </p>
    </div>

    <div class="education-card">
      <h2>地址类型科普与风险场景</h2>
      <p class="education-intro">
        下表用于帮助普通用户理解：不同地址并非“谁绝对安全”，关键在于是否暴露了可被量子攻击目标化的公钥信息。
      </p>
      <div class="knowledge-list">
        <div v-for="item in addressKnowledge" :key="item.type" class="knowledge-item">
          <h3>{{ item.type }}</h3>
          <p><strong>科普：</strong>{{ item.science }}</p>
          <p><strong>风险场景：</strong>{{ item.risk }}</p>
        </div>
      </div>
      <p class="note">
        实践建议：优先使用新地址收款、减少地址复用、及时将长期资产迁移到你认可的更安全方案。
      </p>
    </div>

    <section class="faq-card" aria-label="比特币量子风险常见问题">
      <h2>常见问题（FAQ）</h2>
      <details>
        <summary>1. 什么情况下比特币地址更容易受到量子风险影响？</summary>
        <p>
          当地址的公钥已在链上暴露时（例如地址已有花费记录，或 Taproot 地址输出公钥可直接关联），理论上的量子攻击面会更大。
        </p>
      </details>
      <details>
        <summary>2. 风险等级“高/中/低”代表什么？</summary>
        <p>
          这是基于地址类型、花费历史、公钥暴露状态和链上活跃度的综合评估，用于风险教育与运营优先级排序，不构成投资建议。
        </p>
      </details>
      <details>
        <summary>3. 为什么建议先小额测试再迁移？</summary>
        <p>
          小额测试可以验证地址正确性、手续费设置和钱包链路，减少大额一次性转账因操作错误造成的不可逆损失。
        </p>
      </details>
      <details>
        <summary>4. 页面中的证据链接有什么用途？</summary>
        <p>
          证据链接会跳转到 Blockstream/Mempool 对应交易页面，帮助你复核“首次暴露”“最近活跃”等判断，提升可追溯性与可信度。
        </p>
      </details>
      <details>
        <summary>5. 多签或脚本路径里，脚本暴露后谁的公钥算暴露面？</summary>
        <p>
          定性理解：赎回脚本随花费公开后，脚本中出现的各参与方公钥（及脚本规则下可关联到的密钥材料）都可能成为链上可见的暴露面，具体范围取决于脚本类型与本次花费路径。本页仅为科普提示，复杂脚本需结合钱包说明或专业审计。
        </p>
      </details>
      <details>
        <summary>6. 测试网和主网能混着分析吗？</summary>
        <p>
          当前接口默认按<strong>比特币主网</strong>查询。请勿将测试网地址与主网地址混在同一批里；自建后端时请以自己的节点与 BLOCKSTREAM_API 配置为准。
        </p>
      </details>
      <details>
        <summary>7. 风险分低就等于安全吗？</summary>
        <p>
          不等于。分数是在当前链上数据与模型假设下的<strong>相对</strong>评估，用于前瞻性风险教育；量子威胁与协议演进均有不确定性。低分不是对未来任何场景的担保。
        </p>
      </details>
      <details>
        <summary>8. 数据从哪来？为何不能百分百还原真实情况？</summary>
        <p>
          默认使用 Blockstream 等公开 API（自建后端时可换数据源）。链上只能看到已索引的交易，无法覆盖链下行为与未上链操作，因此存在延迟与盲区。
        </p>
      </details>
    </section>

    <details class="quantum-card" open>
      <summary class="quantum-summary">
        量子计算如何可能加速破解私钥（点击展开/收起）
        <span class="stage-tag">研究阶段（非即时威胁）</span>
      </summary>
      <h2>量子计算如何可能加速破解私钥</h2>
      <p>
        <strong>原理简述：</strong>{{ quantumStage.principle }}
      </p>
      <p>
        <strong>当前阶段：</strong>{{ quantumStage.now }}
      </p>
      <p>
        <strong>对普通用户最重要的一点：</strong>{{ quantumStage.keyPoint }}
      </p>
      <ul class="quantum-list">
        <li>短期：主要是前瞻性风险管理，不是“明天就会被全面攻破”。</li>
        <li>中期：关注比特币社区抗量子升级路线（新地址类型/新签名机制）。</li>
        <li>长期：若容错量子机成熟，已暴露公钥地址会先成为高优先级目标。</li>
      </ul>
      <p class="ref-title"><strong>参考资料：</strong></p>
      <ul class="ref-list">
        <li v-for="item in quantumReferences" :key="item.url">
          <a :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.name }}</a>
        </li>
      </ul>
    </details>
    </div>

    <section id="action-guide" class="action-guide-card" aria-labelledby="action-guide-title">
      <header class="action-guide-header">
        <h2 id="action-guide-title">迁移检查与收款习惯</h2>
        <div class="action-guide-actions no-print">
          <button type="button" class="export-btn" @click="printActionGuide">打印本清单</button>
          <button type="button" class="export-btn muted" @click="resetChecklist">清空勾选</button>
        </div>
      </header>
      <p class="action-guide-lead">
        下列清单可对照执行；勾选状态仅保存在本浏览器，便于分步推进与打印存档。
      </p>

      <h3 class="action-guide-sub">迁移检查清单</h3>
      <ul class="checklist">
        <li v-for="step in migrationSteps" :key="step.key" class="checklist-item">
          <label class="checklist-label">
            <input v-model="checklistState[step.key]" type="checkbox" class="checklist-input" />
            <span class="checklist-text">
              <strong>{{ step.title }}</strong>
              <span class="checklist-detail">{{ step.detail }}</span>
            </span>
          </label>
        </li>
      </ul>

      <h3 class="action-guide-sub">钱包与日常使用习惯（通用建议）</h3>
      <ul class="habit-list">
        <li v-for="(line, idx) in walletHabits" :key="idx">{{ line }}</li>
      </ul>
      <p class="action-guide-note">
        以上为风险管理教育用途，不构成投资建议或任何机构背书；具体方案请结合你的实际情况与合规要求。
      </p>
    </section>
  </div>
</template>
