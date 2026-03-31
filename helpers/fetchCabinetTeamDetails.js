import requestApiJson from '@helpers/requestApiJson'

const fetchCabinetTeamDetails = async ({ teamId }) => {
  if (!teamId || typeof teamId !== 'string') {
    throw new Error('Не передан идентификатор команды')
  }

  const params = new URLSearchParams({ teamId })
  const { json } = await requestApiJson(`/api/cabinet/team-details?${params.toString()}`, {
    fallbackMessage: 'Не удалось загрузить команду',
  })

  const team = json?.data && typeof json.data === 'object' ? json.data : null
  if (!team) {
    throw new Error('Команда не найдена')
  }

  return team
}

export default fetchCabinetTeamDetails
