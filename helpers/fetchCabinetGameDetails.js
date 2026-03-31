import requestApiJson from '@helpers/requestApiJson'

const fetchCabinetGameDetails = async ({ gameId, location = null, rolePreview = null }) => {
  if (!gameId || typeof gameId !== 'string') {
    throw new Error('Не передан идентификатор игры')
  }

  const params = new URLSearchParams({ gameId })
  if (typeof location === 'string' && location.trim()) {
    params.set('location', location.trim())
  }
  if (typeof rolePreview === 'string' && rolePreview.trim()) {
    params.set('rolePreview', rolePreview.trim())
  }

  const { json } = await requestApiJson(`/api/cabinet/game-details?${params.toString()}`, {
    fallbackMessage: 'Не удалось загрузить данные игры',
  })

  const game = json?.data && typeof json.data === 'object' ? json.data : null
  if (!game) {
    throw new Error('Игра не найдена')
  }

  return game
}

export default fetchCabinetGameDetails
