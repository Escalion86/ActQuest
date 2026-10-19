// Telegram ID пользователя: пустые и некорректные значения не являются идентификатором.
const normalizeTelegramId = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

module.exports = normalizeTelegramId
