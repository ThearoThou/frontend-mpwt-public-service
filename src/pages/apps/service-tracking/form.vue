<template>
  <div class="d-flex align-center">
    <v-icon class="mr-2" color="primary">carbon:batch-job-step</v-icon>
    <h4 class="text-h5 font-weight-bold mb-0">{{ $t('serviceTracking') }}</h4>
  </div>
  <form class="mt-6">
    <v-text-field
      :label="$t('enterInvoiceNumber')"
      prepend-inner-icon="ant-design:number-outlined"
    />
    <v-btn class="me-4" color="primary" prepend-icon="ic:round-search">
      {{ $t('continue') }}
    </v-btn>
    <v-btn prepend-icon="bx:eraser" variant="text">
      {{ $t('clear') }}
    </v-btn>
  </form>
</template>
<script lang="ts" setup>

</script>
