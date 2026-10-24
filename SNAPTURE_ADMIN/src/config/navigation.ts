import { BarChart3, BookOpen, CalendarDays, FileText, House, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavigationItem {
  path: string
  label: string
  description: string
  icon: LucideIcon
}

export const navigation: NavigationItem[] = [
  { path: '/dashboard', label: 'Dashboard', description: 'Overview of system information and key statistics', icon: House },
  { path: '/policies', label: 'Policies & Guidelines', description: 'Manage waste management policies, guidelines, and ordinances', icon: FileText },
  { path: '/materials', label: 'Educational Materials', description: 'Manage educational materials for waste management awareness', icon: BookOpen },
  { path: '/announcements', label: 'Announcements', description: 'Publish local updates to mobile Home', icon: FileText },
  { path: '/schedules', label: 'Collection Schedule', description: 'Manage waste collection schedules per barangay', icon: CalendarDays },
  { path: '/reports', label: 'Reports', description: 'Report on saved content and collection schedules', icon: BarChart3 },
  { path: '/settings', label: 'Settings', description: 'Manage your account settings and staff access', icon: Settings },
]
