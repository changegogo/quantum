<script setup>
const repoUrl = "https://github.com/changegogo/quantum";
</script>

<template>
  <main class="page trust-page">
    <article class="trust-card">
      <h1>合规与信任</h1>
      <p class="trust-lead">
        以下为使用本工具前的简要说明；详细技术问题请参阅
        <router-link to="/faq">FAQ</router-link>。
      </p>

      <section class="trust-section" aria-labelledby="disclaimer-heading">
        <h2 id="disclaimer-heading">免责声明</h2>
        <p>
          本网站及检测功能仅用于<strong>比特币地址风险教育</strong>与链上公开信息的展示与解释，不构成任何司法辖区下的投资建议、财务建议或法律意见。
        </p>
        <p>
          我们不提供<strong>托管钱包、代客转账、代操作私钥/助记词</strong>或任何形式的资产代管服务。是否持有、转移或卖出资产，应由你自行判断并承担后果。
        </p>
        <p>
          源代码以开放形式供查阅与审阅：
          <a :href="repoUrl" target="_blank" rel="noopener noreferrer">{{ repoUrl }}</a>
          （链接失效或仓库变更时，请以实际公开页面为准。）
        </p>
      </section>

      <section class="trust-section" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">隐私与数据处理</h2>
        <p>
          <strong>分析查询：</strong>单地址与批量分析的结果仅在你当前浏览器标签页的<strong>内存</strong>中展示；刷新或关闭页面后，除非你在本机自行导出（如 CSV），否则本站前端不会替你持久保存这些结果。
        </p>
        <p>
          <strong>可选本地缓存：</strong>首页「迁移检查清单」的勾选状态可保存在本机浏览器的
          <code>localStorage</code> 中，仅用于分步备忘，可随时「清空勾选」；该数据<strong>不会</strong>作为分析请求的一部分自动上传。
        </p>
        <p>
          <strong>后端与网络：</strong>点击分析时，地址会经 HTTPS 发送至你所配置的后端接口以查询链上数据；后端默认使用公开区块浏览器 API。服务器访问日志、留存策略以托管服务商（如 Vercel 等）及其披露为准；本产品侧<strong>未设计</strong>用户注册表或「地址分析历史」业务库。
        </p>
      </section>

      <p class="trust-footer">若你对合规表述有特殊要求（例如面向特定地区用户），请在部署前自行审阅并修改本文案。</p>
    </article>
  </main>
</template>
