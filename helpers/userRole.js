import { USER_ROLE_VALUES } from './userRoles'

const userRole = (user) =>
  USER_ROLE_VALUES.includes(user?.role) ? user.role : 'client'

export default userRole
