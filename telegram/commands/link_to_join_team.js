import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'

const link_to_join_team = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand?.teamId)
  if (team.success === false) return team

  return {
    message: `Код для присоединения к команде: <code>${jsonCommand?.teamId}</code>.\nКликните по коду, чтобы скопировать его, затем отправьте пользователю, которого хотите пригласить. Этот код необходимо ввести в поле "Присоединиться к команде"`,
    buttons: [{ cmd: 'menu_teams', text: '\u{2B05} Назад' }],
  }
}

export default link_to_join_team
