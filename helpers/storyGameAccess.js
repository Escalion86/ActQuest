const normalizeRole = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export const canCreateStoryGame = (role) =>
  ['admin', 'dev'].includes(normalizeRole(role))

export default canCreateStoryGame
