<script lang="ts" setup>
  import { onMounted } from 'vue'
  import { useRouter } from 'vue-router'

  const router = useRouter()

  onMounted(() => {
    router.push('/account/profile')
  })
</script>

<template>
  <div />
</template>
