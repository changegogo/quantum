<script setup>
const weights = [
  { label: "基础分", pts: "25", note: "所有地址起点相同，便于相对比较。" },
  {
    label: "公钥暴露",
    pts: "+45（条件触发）",
    note: "若链上解析判定公钥相关密钥材料已可被观察者获得，则叠加该项。",
  },
  {
    label: "花费历史",
    pts: "+20（spent > 0）",
    note: "曾有过花费通常意味着解锁路径已在链上展开，可见信息多于从未花费的理想情形。",
  },
  {
    label: "Taproot（P2TR）",
    pts: "+10（bc1p…）",
    note: "与输出承诺及公钥关联方式有关；在「量子攻击公钥」叙事里常更早进入关注区间（不代表 Taproot 在其他维度一定更差）。",
  },
];

const thresholds = [
  { range: "≥ 75", level: "高", note: "优先审视迁移与隔离策略。" },
  { range: "45–74", level: "中", note: "收紧地址使用习惯并持续观察。" },
  { range: "< 45", level: "低", note: "信号相对温和，仍需良好习惯。" },
];

const limitations = [
  "数据来自公开区块索引（默认 Blockstream API）；同步延迟、索引口径差异可能导致时间线与余额与浏览器略有出入。",
  "链上交易拉取存在分页与遍历次数上限，极高活跃地址可能无法穷尽每一笔历史；一般地址的结论方向仍具参考价值。",
  "复杂脚本、多路径合约、隐私增强路径无法仅靠公开 API 完整还原；边缘脚本下的「公钥暴露」判定可能存在误判或漏判。",
  "无法观测链下行为（未广播交易、私下协商、托管内部账本等）。",
];

const misconceptionBlocks = [
  {
    title: "「Taproot 更隐私」与「量子叙事里更早关注公钥」矛盾吗？",
    lines: [
      "不矛盾。Taproot 在链上隐私与表达能力等维度上有其设计优势；但在「攻击面是否更早与公钥相关密钥材料产生链上关联」这条叙事下，本工具可能对 P2TR 叠加额外权重。",
      "两者讨论的是不同维度，阅读结果时应避免非黑即白。",
    ],
  },
  {
    title: "风险分低就等于「永远安全」吗？",
    lines: [
      "不等于。分数反映的是当前模型与可见链上证据下的相对优先级，用于教育与排序；协议演进、钱包行为与未来威胁模型都会变化。",
      "低风险不是「保险箱」式承诺；更完整的法律与用途边界见合规页。",
    ],
  },
];
</script>

<template>
  <main class="page method-page">
    <article class="method-card">
      <header class="method-header">
        <h1>模型说明与方法论</h1>
        <p class="method-lead">
          下文说明本工具<strong>风险分</strong>与<strong>等级</strong>的口径（与当前前后端实现一致），以及适用边界与常见误解。更多问答见
          <router-link to="/faq">FAQ</router-link>，声明与隐私见
          <router-link to="/trust">合规与信任</router-link>。
        </p>
      </header>

      <section class="method-section" aria-labelledby="model-heading">
        <h2 id="model-heading">风险分从哪里来？</h2>
        <p>
          整改建议中的<strong>风险分</strong>（如 <code>remediationAdvice.riskScore</code>）在固定起点上，根据是否判定<strong>公钥已暴露</strong>、是否存在<strong>花费历史</strong>、是否为
          <strong>Taproot</strong> 叠加得分，最高 100 分，再映射为高 / 中 / 低三档；首页条形图为便于对照采用相同逻辑。
        </p>

        <div class="method-table-wrap">
          <table class="method-table">
            <thead>
              <tr>
                <th scope="col">因子</th>
                <th scope="col">分值</th>
                <th scope="col">含义（简述）</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in weights" :key="row.label">
                <td>{{ row.label }}</td>
                <td class="mono">{{ row.pts }}</td>
                <td>{{ row.note }}</td>
              </tr>
              <tr class="method-table-total">
                <td colspan="3">总分<strong>封顶 100</strong>；各因子与后端实现保持一致。</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 class="method-sub">等级阈值</h3>
        <ul class="method-list">
          <li v-for="t in thresholds" :key="t.range">
            <strong>{{ t.range }}</strong> 分 → <strong>{{ t.level }}</strong>：{{ t.note }}
          </li>
        </ul>

        <h3 class="method-sub">局限与不确定性（必读）</h3>
        <ul class="method-list method-list-warn">
          <li v-for="(line, idx) in limitations" :key="idx">{{ line }}</li>
        </ul>
      </section>

      <section class="method-section" aria-labelledby="quantum-lite-heading">
        <h2 id="quantum-lite-heading">量子风险极简科普</h2>
        <p>
          不涉及 Shor 公式细节；仅帮助理解「链上能看到什么」与工具为何关心<strong>公钥是否进入可见范围</strong>。
        </p>
        <p>
          <strong>仅哈希层面：</strong>收款阶段常见形态下，观察者往往先看到与地址对应的哈希标识，而非完整公钥本身。
        </p>
        <p>
          <strong>公钥相关可见：</strong>当花费等行为需要在见证或脚本中揭示公钥或可推导密钥材料时，链上索引即可关联到针对该钥材的攻击输入讨论（仍是理论前瞻语境）。
        </p>
        <p>
          <strong>为何「花费过」常与更大暴露面一同讨论：</strong>典型花费会在输入解锁路径上展示更多信息；模型对「已有花费」给予权重，表达的是<strong>可见链上信息增多</strong>，而非断言已发生现实量子攻击。
        </p>

        <figure class="method-figure" aria-label="链上可见性大致阶段示意">
          <figcaption class="method-caption">示意图：可见性大致阶段（非精确法律或密码学定义）</figcaption>
          <div class="method-timeline" role="presentation">
            <div class="method-timeline-track">
              <div class="method-timeline-step">
                <span class="method-dot"></span>
                <span class="method-step-label">地址标识可见</span>
                <span class="method-step-hint">常用于对外收款</span>
              </div>
              <span class="method-timeline-arrow" aria-hidden="true">→</span>
              <div class="method-timeline-step">
                <span class="method-dot"></span>
                <span class="method-step-label">未花费</span>
                <span class="method-step-hint">解锁细节未展开</span>
              </div>
              <span class="method-timeline-arrow" aria-hidden="true">→</span>
              <div class="method-timeline-step method-timeline-step-strong">
                <span class="method-dot"></span>
                <span class="method-step-label">花费 / 解锁</span>
                <span class="method-step-hint">见证与脚本更易被索引</span>
              </div>
            </div>
          </div>
        </figure>

        <p class="method-note">
          脚本类型众多，具体判定以链上解析与本工具输出为准；上图仅为直觉辅助。
        </p>
      </section>

      <section class="method-section" aria-labelledby="miscon-heading">
        <h2 id="miscon-heading">常见误解（避免非黑即白）</h2>
        <div class="method-callouts">
          <article v-for="block in misconceptionBlocks" :key="block.title" class="method-callout">
            <h3 class="method-callout-title">{{ block.title }}</h3>
            <p v-for="(line, idx) in block.lines" :key="idx" class="method-callout-body">{{ line }}</p>
          </article>
          <p class="method-cross-link">
            <router-link to="/trust">→ 合规与信任（免责声明全文）</router-link>
          </p>
        </div>
      </section>
    </article>
  </main>
</template>
