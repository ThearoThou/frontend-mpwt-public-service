<template>
  <div class="auth-layout">
    <header class="auth-top-bar">
      <LanguageSwitcher display="flags" variant="dark" />
    </header>

    <router-view />
  </div>
</template>

<style scoped>
  .auth-layout { min-height: 100vh; }
  .auth-top-bar { align-items: center; display: flex; height: 64px; justify-content: flex-end; left: 0; padding: 0 32px; pointer-events: none; position: absolute; right: 0; top: 0; z-index: 10; }
  .auth-top-bar > * { pointer-events: auto; }
  @media (max-width: 600px) { .auth-top-bar { height: 56px; padding-inline: 12px; } }
</style>
