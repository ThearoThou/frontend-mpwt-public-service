export type VehiclePlateCategory = 'PROVINCE' | 'PERSONALIZED_CAMBODIA'

export interface VehicleLookupQuery {
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
  search?: string
  registrationNumber?: string
  chassisNumber?: string
  plateNumber?: string
  plateCategory?: VehiclePlateCategory
  plateProvince?: string
  firstRegistrationDate?: string
}

export interface Vehicle {
  id: string
  linkedCitizenId: string | null
  registrationNumber: string
  plateNumber: string
  plateCategory: VehiclePlateCategory
  plateProvince: string | null
  plateDisplayLabelKh: string
  plateType: string
  vehicleType: string
  vehicleClass: 'LIGHT' | 'HEAVY' | null
  inspectionCategoryId: string | null
  classificationVerifiedAt: string | null
  make: string
  model: string
  manufactureYear: number | null
  chassisNumber: string
  firstRegistrationDate: string
  lastInspectionDate: string | null
  inspectionExpiryDate: string
  registeredOwnerNameKh: string
  registeredOwnerNameEn: string
  registeredOwnerPhone: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiPaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export const CAMBODIAN_CAPITAL_PROVINCES_KH = [
  'ភ្នំពេញ',
  'បន្ទាយមានជ័យ',
  'បាត់ដំបង',
  'កំពង់ចាម',
  'កំពង់ឆ្នាំង',
  'កំពង់ស្ពឺ',
  'កំពង់ធំ',
  'កំពត',
  'កណ្ដាល',
  'កែប',
  'កោះកុង',
  'ក្រចេះ',
  'មណ្ឌលគិរី',
  'ឧត្តរមានជ័យ',
  'ប៉ៃលិន',
  'ព្រះសីហនុ',
  'ព្រះវិហារ',
  'ព្រៃវែង',
  'ពោធិ៍សាត់',
  'រតនគិរី',
  'សៀមរាប',
  'ស្ទឹងត្រែង',
  'ស្វាយរៀង',
  'តាកែវ',
  'ត្បូងឃ្មុំ',
] as const
