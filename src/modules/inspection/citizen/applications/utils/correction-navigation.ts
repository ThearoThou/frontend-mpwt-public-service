export function correctionApplicationRoute (applicationId: string) {
  return {
    path: `/services/inspection/applications/${applicationId}`,
    query: { tab: 'documents', focus: 'correction' },
  }
}
