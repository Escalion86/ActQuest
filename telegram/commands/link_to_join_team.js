import getTeam from 'telegram/func/getTeam'

const link_to_join_team = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand?.teamId) {
    const team = await getTeam(jsonCommand?.teamId)
    if (!team || team.length === 0) {
      return {
        message: 'Ошибка. Команда не найдена',
        nextCommand: `menu_teams`,
      }
    }
  }
  return {
    message: `Код для присоединения к команде: <code>${jsonCommand?.teamId}</code>.\nКликните по коду, чтобы скопировать его, затем отправьте пользователю, которого хотите пригласить. Этот код необходимо ввести в поле "Присоединиться к команде"`,
    buttons: [{ command: 'menu_teams', text: '\u{2B05} Назад' }],
  }
}

export default link_to_join_team
