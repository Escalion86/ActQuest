import { USER_ROLE_NAMES } from './userRoles'
import userRole from './userRole'

const userRoleName = (user) =>
  USER_ROLE_NAMES[userRole(user)] || 'Пользователь'

export default userRoleName
