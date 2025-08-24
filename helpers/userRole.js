import { USERS_ROLES } from 'telegram/constants'

const userRole = (user) =>
  USERS_ROLES.includes(user.role) ? user.role : 'client'

export default userRole
