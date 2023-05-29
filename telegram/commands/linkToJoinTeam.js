import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'

const linkToJoinTeam = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand?.teamId)
  if (team.success === false) return team

  return {
    message: `Код для присоединения к команде:\n\n<code>${jsonCommand?.teamId}</code>\n\nКликните по коду, чтобы скопировать его, затем отправьте пользователям, которых хотите пригласить. Этот код необходимо ввести пользователям в поле "Команды" => "Присоединиться к команде"`,
    buttons: [
      {
        cmd: { cmd: 'editTeam', teamId: jsonCommand.teamId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default linkToJoinTeam
