import requestApiJson from '@helpers/requestApiJson'

const fetchCabinetUserDetails = async ({ userId = '', telegramId = null }) => {
  const params = new URLSearchParams()
  if (typeof userId === 'string' && userId.trim()) {
    params.set('userId', userId.trim())
  }
  if (telegramId !== null && telegramId !== undefined && String(telegramId).trim()) {
    params.set('telegramId', String(telegramId).trim())
  }

  if (![...params.keys()].length) {
    throw new Error('Не передан идентификатор пользователя')
  }

  const { json } = await requestApiJson(`/api/cabinet/user-details?${params.toString()}`, {
    fallbackMessage: 'Не удалось загрузить пользователя',
  })

  const user = json?.data && typeof json.data === 'object' ? json.data : null
  if (!user) {
    throw new Error('Пользователь не найден')
  }

  return user
}

export default fetchCabinetUserDetails
