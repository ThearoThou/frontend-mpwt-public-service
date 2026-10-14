import type { RenewalApplication, RenewalApplicationListItem } from '../../applications/types/application.types'
import type { Vehicle } from '../../vehicles/types/vehicle.types'
import { isAxiosError } from 'axios'
import { useRouter } from 'vue-router'
import { inspectionApplicationService } from '../../applications/services/application.service'
import { correctionApplicationRoute } from '../../applications/utils/correction-navigation'
import { findUnfinishedApplication, resolveRenewalEntryDecision } from '../utils/renewal-entry-action'

type ApiErrorResponse = { code?: string }

type RenewalEntryFlowOptions = {
  onApplicationsLoaded?: (applications: RenewalApplicationListItem[]) => void
  onError?: (messageKey: string) => void
}

export function useRenewalEntryFlow (options: RenewalEntryFlowOptions = {}) {
  const router = useRouter()
  const confirmationVehicle = ref<Vehicle | null>(null)
  const confirmationOpen = ref(false)
  const renewingVehicleIds = ref(new Set<string>())

  const confirmationLoading = computed(() => confirmationVehicle.value !== null && isRenewingVehicle(confirmationVehicle.value.id))

  async function startOrContinueRenewal (vehicle: Vehicle): Promise<void> {
    if (isRenewingVehicle(vehicle.id)) {
      return
    }

    setRenewing(vehicle.id, true)
    options.onError?.('')
    try {
      const applications = await loadApplications()
      const decision = resolveRenewalEntryDecision(applications, vehicle.id, vehicle.inspectionExpiryDate)
      if (decision.kind === 'continue') {
        await navigateToActiveRenewal(decision.application)
        return
      }

      if (decision.kind === 'confirm') {
        confirmationVehicle.value = vehicle
        confirmationOpen.value = true
        return
      }

      await createRenewal(vehicle.id)
    } catch (error) {
      options.onError?.(renewalErrorKey(error))
    } finally {
      setRenewing(vehicle.id, false)
    }
  }

  async function confirmRenewal (): Promise<void> {
    const vehicle = confirmationVehicle.value
    if (vehicle === null || isRenewingVehicle(vehicle.id)) {
      return
    }

    confirmationOpen.value = false
    setRenewing(vehicle.id, true)
    options.onError?.('')
    try {
      await createRenewal(vehicle.id)
    } catch (error) {
      if (isUnfinishedApplicationError(error)) {
        const applications = await loadApplications()
        const active = findUnfinishedApplication(applications, vehicle.id)
        if (active !== undefined) {
          await navigateToActiveRenewal(active)
          return
        }
      }
      options.onError?.(renewalErrorKey(error))
    } finally {
      setRenewing(vehicle.id, false)
      confirmationVehicle.value = null
    }
  }

  async function createRenewal (vehicleId: string): Promise<void> {
    try {
      const draft = await inspectionApplicationService.createDraft(vehicleId)
      await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: draft.id } })
    } catch (error) {
      if (!isUnfinishedApplicationError(error)) {
        throw error
      }

      const applications = await loadApplications()
      const active = findUnfinishedApplication(applications, vehicleId)
      if (active === undefined) {
        throw error
      }
      await navigateToActiveRenewal(active)
    }
  }

  async function loadApplications (): Promise<RenewalApplicationListItem[]> {
    const response = await inspectionApplicationService.listCitizenApplications({ limit: 100, sortOrder: 'desc' })
    options.onApplicationsLoaded?.(response.data)
    return response.data
  }

  async function navigateToActiveRenewal (application: RenewalApplication): Promise<void> {
    if (application.status === 'DRAFT') {
      await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: application.id } })
      return
    }
    if (application.status === 'CORRECTION_REQUIRED') {
      await router.push(correctionApplicationRoute(application.id))
      return
    }
    await router.push({ path: `/services/inspection/applications/${application.id}` })
  }

  function isRenewingVehicle (vehicleId: string): boolean {
    return renewingVehicleIds.value.has(vehicleId)
  }

  function setRenewing (vehicleId: string, renewing: boolean): void {
    const ids = new Set(renewingVehicleIds.value)
    if (renewing) {
      ids.add(vehicleId)
    } else {
      ids.delete(vehicleId)
    }
    renewingVehicleIds.value = ids
  }

  function isUnfinishedApplicationError (error: unknown): boolean {
    return isAxiosError<ApiErrorResponse>(error) && error.response?.data?.code === 'UNFINISHED_APPLICATION_ALREADY_EXISTS'
  }

  function renewalErrorKey (error: unknown): string {
    if (!isAxiosError<ApiErrorResponse>(error)) {
      return 'inspection_draft_creation_error'
    }
    if (error.response?.data?.code === 'VEHICLE_CLASSIFICATION_INCOMPLETE') {
      return 'inspection_vehicle_classification_incomplete'
    }
    return 'inspection_draft_creation_error'
  }

  return {
    confirmationLoading,
    confirmationOpen,
    confirmRenewal,
    isRenewingVehicle,
    startOrContinueRenewal,
  }
}
