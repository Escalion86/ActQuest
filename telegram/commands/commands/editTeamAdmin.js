import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'

const editTeamAdmin = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand.teamId)
  if (team.success === false) return team

  const buttons = [
    // {
    //   c: { c: 'setTeamName', teamId: jsonCommand.teamId },
    //   text: '\u{270F} Изменить название',
    // },
    // {
    //   c: {
    //     c: 'setTeamDesc',
    //     teamId: jsonCommand.teamId,
    //   },
    //   hide: !isCapitan,
    //   text: '\u{270F} Изменить описание',
    // },
    {
      c: { c: 'teamGamesAdmin', teamId: jsonCommand.teamId },
      text: '\u{1F3AE} Игры команды',
    },
    {
      c: { c: 'teamUsersAdmin', teamId: jsonCommand.teamId },
      text: '\u{1F465} Состав команды',
    },
    // {
    //   c: { c: 'unjoinTeam', teamId: jsonCommand.teamId },
    //   text: '\u{1F4A3} Покинуть команду',
    //   hide: isCapitan,
    // },
    // {
    //   c: { c: 'linkToJoinTeam', teamId: jsonCommand.teamId },
    //   text: '\u{1F517} Пригласить в команду',
    // },
    {
      c: { c: 'deleteTeamAdmin', teamId: jsonCommand.teamId },
      text: '\u{1F4A3} Удалить команду',
    },
    { c: 'teams', text: '\u{2B05} Назад' },
  ]

  return {
    message: `<b>АДМИНИСТРИРОВАНИЕ</b>\n\n<b>Редактирование команды "${
      team?.name
    }"</b>.${
      team?.description ? `\n\n<b>Описание</b>: "${team?.description}"` : ''
    }`,
    buttons,
  }
}

export default editTeamAdmin
