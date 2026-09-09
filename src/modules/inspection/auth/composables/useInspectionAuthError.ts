import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

interface InspectionAuthErrorState<Kind extends string> {
  fieldKeys: string[]
  key: string
  kind: Kind
}

export function useInspectionAuthError<Kind extends string> () {
  const { t } = useI18n()
  const error = shallowRef<InspectionAuthErrorState<Kind> | null>(null)
  const errorKind = computed(() => error.value?.kind ?? null)
  const errorMessage = computed(() => {
    if (error.value === null) {
      return ''
    }

    if (error.value.fieldKeys.length > 0) {
      return t(error.value.key, {
        fields: error.value.fieldKeys.map(key => t(key)).join(', '),
      })
    }

    return t(error.value.key)
  })

  function clearError () {
    error.value = null
  }

  function showError (kind: Kind, key: string, fieldKeys: string[] = []) {
    error.value = { fieldKeys: [...fieldKeys], key, kind }
  }

  return { clearError, errorKind, errorMessage, showError }
}
