import { USERS_ROLES } from 'telegram/constants'

const userRole = (user) => USERS_ROLES[user.role] || 'client'

export default userRole
