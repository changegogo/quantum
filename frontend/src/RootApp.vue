<script setup>
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div>
    <header class="top-nav">
      <RouterLink to="/">首页</RouterLink>
      <RouterLink to="/faq">FAQ</RouterLink>
    </header>
    <RouterView />
  </div>
</template>
