<script lang="ts" setup>
  import { onMounted, ref, watch } from 'vue'
  import { useTheme } from 'vuetify'

  const emit = defineEmits(['theme-changed'])
  const theme = useTheme()

  // reactive state for the switch
  const isDark = ref<boolean>(false)

  // initialize from localStorage (or fallback to Vuetify if available)
  onMounted(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') {
      isDark.value = true
      theme.global.name.value = 'dark'
    } else if (saved === 'light') {
      isDark.value = false
      theme.global.name.value = 'light'
    } else {
      // if nothing saved, try to reflect current Vuetify theme
      try {
        isDark.value = theme.global.name.value === 'dark'
      } catch {
        isDark.value = false
      }
    }
  })

  // when toggled, update Vuetify theme and persist
  watch(isDark, val => {
    try {
      theme.global.name.value = val ? 'dark' : 'light'
    } catch {
    // ignore if theme not available
    }
    localStorage.setItem('theme', val ? 'dark' : 'light')
    emit('theme-changed', val)
  })
</script>

<template>
  <v-btn
    icon
    variant="text"
    @click="isDark = !isDark"
  >
    <v-icon>{{ isDark ? 'mdi-weather-night' : 'mdi-white-balance-sunny' }}</v-icon>
  </v-btn>
</template>
<!--:append-icon="isDark ? 'mdi-weather-night' : 'mdi-white-balance-sunny'"-->
