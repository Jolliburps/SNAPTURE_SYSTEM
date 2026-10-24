import type { CollectionSchedule, DashboardStatistics, EducationalMaterial, Policy, RegistrationPoint, User } from '../types'

// Static content fixtures only. No API or database is used.
export const mockAdmin = { name: 'Admin', organization: 'CESD Bacoor', initials: 'A' }
export const samplePeriod = 'Oct 1, 2026 – Oct 31, 2026'

export const dashboardStatistics: DashboardStatistics = {
  registeredUsers: 0,
  activePolicies: 0,
  educationalMaterials: 0,
  collectionSchedules: 0,
}

export const registrationTrend: RegistrationPoint[] = [
  { month: 'May', users: 0 }, { month: 'Jun', users: 0 },
  { month: 'Jul', users: 0 }, { month: 'Aug', users: 0 },
  { month: 'Sep', users: 0 }, { month: 'Oct', users: 0 },
]

export const mockUsers: User[] = [
  { id: 'U001', name: 'Maria Santos', barangay: 'Molino', dateJoined: '2026-10-01', status: 'Active' },
  { id: 'U002', name: 'Juan Dela Cruz', barangay: 'Molino', dateJoined: '2026-10-02', status: 'Active' },
  { id: 'U003', name: 'Ana Reyes', barangay: 'Bayanan', dateJoined: '2026-10-03', status: 'Inactive' },
]

export const mockPolicies: Policy[] = [
  { id: 'P001', title: 'Waste Segregation Guidelines', category: 'Segregation', effectiveDate: '2026-10-01', status: 'Published' },
  { id: 'P002', title: 'Plastic Disposal Regulations', category: 'Disposal', effectiveDate: '2026-09-28', status: 'Published' },
  { id: 'P003', title: 'Recycling Guidelines', category: 'Recycling', effectiveDate: '2026-09-15', status: 'Updated' },
]

export const mockMaterials: EducationalMaterial[] = [
  { id: 'M001', title: 'How to Recycle at Home', type: 'Infographic', dateAdded: '2026-10-01', status: 'Published' },
  { id: 'M002', title: 'Composting Basics', type: 'Guide', dateAdded: '2026-09-26', status: 'Published' },
  { id: 'M003', title: 'Plastic Waste Awareness', type: 'Video', dateAdded: '2026-09-18', status: 'Published' },
]

export const mockSchedules: CollectionSchedule[] = [
  { id: 'S001', wasteType: 'Recyclable', barangay: 'Molino', date: '2026-10-02', time: '08:00', status: 'Scheduled' },
  { id: 'S002', wasteType: 'Biodegradable', barangay: 'Bayanan', date: '2026-10-03', time: '08:00', status: 'Scheduled' },
  { id: 'S003', wasteType: 'Residual', barangay: 'Talaba', date: '2026-10-04', time: '08:00', status: 'Scheduled' },
]
