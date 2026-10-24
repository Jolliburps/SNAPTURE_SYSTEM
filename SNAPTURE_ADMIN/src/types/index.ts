export type PublicationStatus = 'Published' | 'Updated' | 'Draft'
export type WasteType = 'Recyclable' | 'Biodegradable' | 'Residual'
export type MaterialType = 'Infographic' | 'Guide' | 'Video'

export interface User {
  id: string
  name: string
  barangay: string
  dateJoined: string
  status: 'Active' | 'Inactive'
}

export interface Policy {
  id: string
  title: string
  category: string
  effectiveDate: string
  status: PublicationStatus
}

export interface EducationalMaterial {
  id: string
  title: string
  type: MaterialType
  dateAdded: string
  status: PublicationStatus
}

export interface CollectionSchedule {
  id: string
  wasteType: WasteType
  barangay: string
  date: string
  time: string
  status: 'Scheduled' | 'Cancelled'
}

export interface RegistrationPoint {
  month: string
  users: number
}

export interface DashboardStatistics {
  registeredUsers: number
  activePolicies: number
  educationalMaterials: number
  collectionSchedules: number
}
