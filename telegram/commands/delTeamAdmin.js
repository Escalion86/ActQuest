import check from 'telegram/func/check'

const delTeamAdmin = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  //TODO добавить проверку, что команда не играла

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление команды',
      buttons: [
        {
          text: '\u{1F4A3} Удалить',
          c: { confirm: true },
          // `delTeam` + propsToStr(props)
        },
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editTeamAdmin',
            teamId: jsonCommand.teamId,
            page: jsonCommand.page,
          },
        },
      ],
    }
  }
  const team = await db.model('Teams').findByIdAndRemove(jsonCommand.teamId)
  const teamUsers = await db
    .model('TeamsUsers')
    .deleteMany({ teamId: jsonCommand.teamId })
  const gameTeams = await db
    .model('GamesTeams')
    .deleteMany({ teamId: jsonCommand.teamId })
  return {
    success: true,
    message: 'Команда удалена',
    nextCommand: { c: `teams`, page: jsonCommand.page },
  }
}

export default delTeamAdmin
