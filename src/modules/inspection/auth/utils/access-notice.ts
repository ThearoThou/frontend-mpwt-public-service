export const inspectionAccessNotice = reactive({ visible: false })

export function showInspectionLoginRequiredNotice () {
  inspectionAccessNotice.visible = false
  nextTick(() => {
    inspectionAccessNotice.visible = true
  })
}
