export type AppLocale = 'en' | 'ar'

export type MembershipRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'staff'

export type WorkspaceMembership = {
  tenantId: string
  tenantName: string
  role: MembershipRole
  regionLabel: string
  defaultOutletLabel: string
}

export type SessionUser = {
  id: string
  displayName: string
  email: string
  title: string
}
