<template>
  <footer class="inspection-footer px-4 px-md-6 py-4">
    <div class="inspection-footer-content mx-auto d-flex flex-column flex-md-row align-center justify-space-between ga-3">
      <span>{{ $t('inspection_footer_copyright') }}</span>

      <div class="d-flex flex-wrap justify-center ga-5">
        <a href="#privacy">{{ $t('privacy') }}</a>
        <a href="#terms">{{ $t('terms') }}</a>
        <a href="#contact">{{ $t('contact') }}</a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
  .inspection-footer {
    border-top: 1px solid #d2d3dc;
    color: #4f5060;
  }

  .inspection-footer-content {
    max-width: 1180px;
  }

  .inspection-footer a {
    color: inherit;
    text-decoration: none;
  }

  .inspection-footer a:hover {
    text-decoration: underline;
  }
</style>
