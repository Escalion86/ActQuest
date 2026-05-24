const normalizeString = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const buildGameHistoryActor = ({
  userId = null,
  telegramId = null,
  role = '',
  name = '',
} = {}) => ({
  userId: normalizeString(userId),
  telegramId: normalizeString(telegramId),
  role: typeof role === 'string' ? role.trim() : '',
  name: typeof name === 'string' ? name.trim() : '',
})

export default buildGameHistoryActor
