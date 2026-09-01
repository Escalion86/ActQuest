import requestApiJson from '@helpers/requestApiJson'

const fetchCabinetGameDetails = async ({ gameId, location = null }) => {
  if (!gameId || typeof gameId !== 'string') {
    throw new Error('Не передан идентификатор игры')
  }

  const params = new URLSearchParams({ gameId })
  if (typeof location === 'string' && location.trim()) {
    params.set('location', location.trim())
  }

  const endpointBase = '/api/cabinet/game-details'

  const { json } = await requestApiJson(`${endpointBase}?${params.toString()}`, {
    cache: 'no-store',
    fallbackMessage: 'Не удалось загрузить данные игры',
  })

  const game = json?.data && typeof json.data === 'object' ? json.data : null
  if (!game) {
    throw new Error('Игра не найдена')
  }

  return game
}

export default fetchCabinetGameDetails
