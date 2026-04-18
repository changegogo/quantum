import express from "express";
import cors from "cors";
import axios from "axios";
import {
  detectAddressType,
  evaluatePublicKeyExposure,
  extractAddressLevelPublicKey,
} from "./addressAnalyzer.js";

const app = express();
const PORT = process.env.PORT || 3000;
const BLOCKSTREAM_API = process.env.BLOCKSTREAM_API || "https://blockstream.info/api";
const KNOWN_ADDRESS_OVERRIDES = {
  "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa": {
    forcePublicKeyExposed: true,
    publicKeys: [
      "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f",
    ],
    explanation:
      "该地址关联创世区块历史数据，公开脚本中可见完整公钥，按量子风险视角应视作已暴露。",
    publicKeyHint: "该地址命中已知历史样本库，已返回公开可验证的公钥。",
  },
};

app.use(cors());
app.use(express.json());

function isLikelyPubKey(hex) {
  return /^(02|03)[0-9a-f]{64}$/i.test(hex) || /^04[0-9a-f]{128}$/i.test(hex);
}

function extractPubKeyFromAsm(asm = "") {
  const tokens = asm.split(" ");
  for (const token of tokens) {
    if (isLikelyPubKey(token)) return token;
  }
  return null;
}

function extractTaprootOutputKeyFromAsm(asm = "") {
  const match = asm.match(/OP_1\s+([0-9a-f]{64})/i);
  return match ? match[1] : null;
}

function toIsoOrNull(unixTs) {
  if (!unixTs) return null;
  return new Date(unixTs * 1000).toISOString();
}

function buildExplorerLinks(txid) {
  if (!txid) return null;
  return {
    txid,
    blockstream: `https://blockstream.info/tx/${txid}`,
    mempool: `https://mempool.space/tx/${txid}`,
  };
}

async function fetchConfirmedAddressTxs(address, maxPages = 8) {
  const all = [];
  let lastSeenTxid = null;

  for (let i = 0; i < maxPages; i += 1) {
    const endpoint = lastSeenTxid
      ? `${BLOCKSTREAM_API}/address/${address}/txs/chain/${lastSeenTxid}`
      : `${BLOCKSTREAM_API}/address/${address}/txs/chain`;
    const { data } = await axios.get(endpoint, { timeout: 8000 });
    const page = data || [];
    if (page.length === 0) break;
    all.push(...page);
    lastSeenTxid = page[page.length - 1]?.txid;
    if (!lastSeenTxid || page.length < 25) break;
  }

  return all;
}

function buildRiskTimeline(address, addressType, txs) {
  let firstSpentTs = null;
  let firstPublicKeyExposedTs = null;
  let recentActiveTs = null;
  let firstReceivedTs = null;
  let firstSpentTxid = null;
  let firstPublicKeyExposedTxid = null;
  let recentActiveTxid = null;
  let firstReceivedTxid = null;

  for (const tx of txs || []) {
    const blockTime = tx?.status?.block_time || null;
    if (!blockTime) continue;
    const txid = tx?.txid || null;

    const spentByAddress = (tx.vin || []).some(
      (vin) => vin?.prevout?.scriptpubkey_address === address
    );
    const receivedByAddress = (tx.vout || []).some(
      (vout) => vout?.scriptpubkey_address === address
    );

    if (spentByAddress) {
      if (!firstSpentTs || blockTime < firstSpentTs) {
        firstSpentTs = blockTime;
        firstSpentTxid = txid;
      }
      if (!firstPublicKeyExposedTs || blockTime < firstPublicKeyExposedTs) {
        firstPublicKeyExposedTs = blockTime;
        firstPublicKeyExposedTxid = txid;
      }
    }

    if (receivedByAddress && (!firstReceivedTs || blockTime < firstReceivedTs)) {
      firstReceivedTs = blockTime;
      firstReceivedTxid = txid;
    }

    if ((spentByAddress || receivedByAddress) && (!recentActiveTs || blockTime > recentActiveTs)) {
      recentActiveTs = blockTime;
      recentActiveTxid = txid;
    }
  }

  if (addressType.startsWith("P2TR") && firstReceivedTs) {
    firstPublicKeyExposedTs = firstReceivedTs;
    firstPublicKeyExposedTxid = firstReceivedTxid;
  }

  return {
    firstSpentAt: toIsoOrNull(firstSpentTs),
    firstPublicKeyExposedAt: toIsoOrNull(firstPublicKeyExposedTs),
    recentActiveAt: toIsoOrNull(recentActiveTs),
    evidence: {
      firstSpentTx: buildExplorerLinks(firstSpentTxid),
      firstPublicKeyExposedTx: buildExplorerLinks(firstPublicKeyExposedTxid),
      recentActiveTx: buildExplorerLinks(recentActiveTxid),
    },
  };
}

function buildRemediationAdvice({ addressType, publicKeyExposed, spentTxoCount, riskTimeline }) {
  const isTaproot = addressType.startsWith("P2TR");
  const hasExposureHistory = Boolean(riskTimeline?.firstPublicKeyExposedAt);

  let riskScore = 25;
  if (publicKeyExposed) riskScore += 45;
  if (spentTxoCount > 0) riskScore += 20;
  if (isTaproot) riskScore += 10;
  riskScore = Math.min(riskScore, 100);

  let level = "low";
  if (riskScore >= 75) level = "high";
  else if (riskScore >= 45) level = "medium";

  const actions = [];
  if (level === "high") {
    actions.push("短期内停止向该地址继续收款，避免扩大暴露面。");
    actions.push("将长期资产分批迁移到新地址，并减少地址复用。");
    actions.push("优先采用支持更强隔离策略的钱包（如分层账户、冷存储、多签）。");
    actions.push("建立周期性巡检：每周检查该地址是否新增花费和公钥关联活动。");
  } else if (level === "medium") {
    actions.push("减少该地址复用，后续收款尽量使用新地址。");
    actions.push("将高价值 UTXO 优先迁移到低暴露历史的新地址。");
    actions.push("开启地址监控告警，跟踪首次花费和最近活跃变化。");
  } else {
    actions.push("继续使用新地址收款习惯，避免未来被动进入高暴露状态。");
    actions.push("定期回看时间线，关注是否出现首次花费与公钥暴露事件。");
  }

  if (hasExposureHistory) {
    actions.push("针对已暴露历史地址，避免作为长期储值主地址。");
  }

  const migrationChecklist =
    level === "high"
      ? [
          {
            step: 1,
            title: "先小额测试",
            detail: "先从高风险地址向新地址转一笔小额 BTC，确认收款地址、手续费与钱包链路都正确。",
          },
          {
            step: 2,
            title: "再分批迁移",
            detail:
              "按多笔分批方式迁移主要资产，每批转账后核对到账与链上确认，避免一次性大额操作失误。",
          },
          {
            step: 3,
            title: "最终停用旧地址",
            detail:
              "迁移完成后停止复用旧地址，更新所有收款入口为新地址，并保留旧地址只读监控。",
          },
        ]
      : [];

  return {
    level,
    riskScore,
    summary:
      level === "high"
        ? "量子破解相关风险处于高关注区间，建议尽快执行迁移与隔离。"
        : level === "medium"
          ? "存在一定量子风险暴露，建议尽快优化地址使用策略。"
          : "当前风险相对可控，建议保持良好地址管理习惯。",
    actions,
    migrationChecklist,
  };
}

function buildQuantumReadiness({ addressType, publicKeyExposed, spentTxoCount, riskTimeline }) {
  const checks = [
    {
      key: "noPublicKeyExposure",
      title: "尚未出现明确公钥暴露",
      passed: !publicKeyExposed,
      impact: 35,
    },
    {
      key: "noSpentHistory",
      title: "地址暂无花费历史",
      passed: spentTxoCount === 0,
      impact: 25,
    },
    {
      key: "limitedRecentActivity",
      title: "近期链上活动可控",
      passed: !riskTimeline?.recentActiveAt,
      impact: 15,
    },
    {
      key: "notTaprootPublicKeyAddress",
      title: "非 Taproot 公钥直接关联地址",
      passed: !addressType.startsWith("P2TR"),
      impact: 25,
    },
  ];

  const score = checks.reduce((acc, check) => acc + (check.passed ? check.impact : 0), 0);
  const level = score >= 75 ? "high" : score >= 45 ? "medium" : "low";
  const blockers = checks.filter((check) => !check.passed).map((check) => check.title);

  return {
    score,
    level,
    summary:
      level === "high"
        ? "抗量子准备度较好，继续保持低暴露地址管理策略。"
        : level === "medium"
          ? "抗量子准备度中等，建议优先消除公钥暴露与地址复用。"
          : "抗量子准备度偏低，建议尽快执行迁移和地址隔离。",
    checks,
    blockers,
  };
}

async function fetchAddressPublicKeys(address, addressType) {
  const keys = new Set();
  const { data: txs } = await axios.get(`${BLOCKSTREAM_API}/address/${address}/txs`, {
    timeout: 8000,
  });

  for (const tx of txs || []) {
    for (const vout of tx.vout || []) {
      if (vout?.scriptpubkey_address !== address) continue;
      if (!addressType.startsWith("P2TR")) continue;
      const outputKey = extractTaprootOutputKeyFromAsm(vout?.scriptpubkey_asm || "");
      if (outputKey) keys.add(outputKey);
    }

    for (const vin of tx.vin || []) {
      if (vin?.prevout?.scriptpubkey_address !== address) continue;

      const witness = Array.isArray(vin.witness) ? vin.witness : [];
      for (const item of witness) {
        if (isLikelyPubKey(item)) keys.add(item);
      }

      const scriptSigKey = extractPubKeyFromAsm(vin?.scriptsig_asm || "");
      if (scriptSigKey) keys.add(scriptSigKey);
    }
  }

  return [...keys].slice(0, 5);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

async function analyzeSingleAddress(address) {
  const addressType = detectAddressType(address);
  const knownOverride = KNOWN_ADDRESS_OVERRIDES[address];
  const { data } = await axios.get(`${BLOCKSTREAM_API}/address/${address}`, {
    timeout: 8000,
  });

  const spentTxoCount =
    (data?.chain_stats?.spent_txo_count || 0) + (data?.mempool_stats?.spent_txo_count || 0);
  const fundedTxoCount =
    (data?.chain_stats?.funded_txo_count || 0) + (data?.mempool_stats?.funded_txo_count || 0);
  const fundedTxoSum =
    (data?.chain_stats?.funded_txo_sum || 0) + (data?.mempool_stats?.funded_txo_sum || 0);
  const spentTxoSum =
    (data?.chain_stats?.spent_txo_sum || 0) + (data?.mempool_stats?.spent_txo_sum || 0);
  const txCount = (data?.chain_stats?.tx_count || 0) + (data?.mempool_stats?.tx_count || 0);
  const balanceSats = Math.max(fundedTxoSum - spentTxoSum, 0);
  const balanceBtc = Number((balanceSats / 1e8).toFixed(8));

  const exposure = evaluatePublicKeyExposure(addressType, spentTxoCount);
  const publicKeys = await fetchAddressPublicKeys(address, addressType);
  const confirmedTxs = await fetchConfirmedAddressTxs(address);
  const riskTimeline = buildRiskTimeline(address, addressType, confirmedTxs);
  const addressLevelPubKey = extractAddressLevelPublicKey(address, addressType);
  if (addressLevelPubKey) publicKeys.unshift(addressLevelPubKey);
  const normalizedKeys = [...new Set(publicKeys)].slice(0, 5);
  if (knownOverride?.publicKeys?.length) {
    for (const key of knownOverride.publicKeys) {
      normalizedKeys.unshift(key);
    }
  }
  const dedupedKeys = [...new Set(normalizedKeys)].slice(0, 5);
  const finalPublicKeyExposed = knownOverride?.forcePublicKeyExposed ?? exposure.exposed;
  const remediationAdvice = buildRemediationAdvice({
    addressType,
    publicKeyExposed: finalPublicKeyExposed,
    spentTxoCount,
    riskTimeline,
  });
  const quantumReadiness = buildQuantumReadiness({
    addressType,
    publicKeyExposed: finalPublicKeyExposed,
    spentTxoCount,
    riskTimeline,
  });

  return {
    address,
    addressType,
    publicKeyExposed: finalPublicKeyExposed,
    publicKeys: dedupedKeys,
    confidence: exposure.certainty,
    explanation: knownOverride?.explanation || exposure.reason,
    onChainStats: {
      txCount,
      fundedTxoCount,
      spentTxoCount,
      balanceSats,
      balanceBtc,
    },
    riskTimeline,
    remediationAdvice,
    quantumReadiness,
    dataSource: "blockstream.info",
    publicKeyHint:
      knownOverride?.publicKeyHint ||
      (dedupedKeys.length > 0
        ? "已提取到链上相关公钥/输出公钥。"
        : "暂未提取到可展示公钥（可能因为地址未花费、脚本类型复杂或数据窗口限制）。"),
    warning:
      "该判断用于风险教育，不构成投资或绝对安全结论。复杂脚本/多签地址的公钥暴露情况可能更复杂。",
  };
}

app.get("/api/address/:address", async (req, res) => {
  try {
    const result = await analyzeSingleAddress(req.params.address);
    res.json(result);
  } catch (error) {
    const detail = error?.response?.data || error.message || "未知错误";
    res.status(400).json({
      error: "地址分析失败",
      detail: typeof detail === "string" ? detail : JSON.stringify(detail),
    });
  }
});

app.post("/api/address/batch", async (req, res) => {
  const input = Array.isArray(req.body?.addresses) ? req.body.addresses : [];
  const normalized = [...new Set(input.map((item) => String(item || "").trim()).filter(Boolean))];

  if (normalized.length === 0) {
    return res.status(400).json({ error: "请提供地址数组 addresses，且至少包含 1 个地址" });
  }

  const maxBatch = 30;
  const limited = normalized.slice(0, maxBatch);

  const settled = await Promise.allSettled(limited.map((address) => analyzeSingleAddress(address)));
  const results = [];
  const errors = [];

  for (let i = 0; i < settled.length; i += 1) {
    const item = settled[i];
    if (item.status === "fulfilled") {
      results.push(item.value);
    } else {
      const detail = item.reason?.response?.data || item.reason?.message || "未知错误";
      errors.push({
        address: limited[i],
        detail: typeof detail === "string" ? detail : JSON.stringify(detail),
      });
    }
  }

  const summary = {
    totalRequested: input.length,
    totalProcessed: limited.length,
    successCount: results.length,
    failedCount: errors.length,
    highRiskCount: results.filter((item) => item?.remediationAdvice?.level === "high").length,
    mediumRiskCount: results.filter((item) => item?.remediationAdvice?.level === "medium").length,
    lowRiskCount: results.filter((item) => item?.remediationAdvice?.level === "low").length,
    averageRiskScore: results.length
      ? Math.round(
          results.reduce((acc, item) => acc + (item?.remediationAdvice?.riskScore || 0), 0) /
            results.length
        )
      : 0,
  };

  return res.json({ summary, results, errors });
});

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Bitcoin 地址分析 API 已启动: http://localhost:${PORT}`);
  });
}
