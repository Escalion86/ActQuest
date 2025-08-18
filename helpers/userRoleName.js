import { USERS_ROLES_NAMES } from 'telegram/constants'

const userRoleName = (role) => USERS_ROLES_NAMES[role] || 'Пользователь'

export default userRoleName
