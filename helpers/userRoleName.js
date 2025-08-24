import { USERS_ROLES_NAMES } from 'telegram/constants'
import userRole from './userRole'

const userRoleName = (user) =>
  USERS_ROLES_NAMES[userRole(user)] || 'Пользователь'

export default userRoleName
