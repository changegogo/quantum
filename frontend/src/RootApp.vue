<script setup>
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div>
    <header class="top-nav">
      <RouterLink to="/">首页</RouterLink>
      <RouterLink to="/faq">FAQ</RouterLink>
      <RouterLink to="/trust">合规与信任</RouterLink>
      <RouterLink to="/methodology">模型说明</RouterLink>
    </header>
    <RouterView />
  </div>
</template>
