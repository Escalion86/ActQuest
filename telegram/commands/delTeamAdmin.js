import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const delTeamAdmin = async ({ telegramId, jsonCommand }) => {
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
          text: '\u{1F5D1} Удалить',
          c: { confirm: true },
          // `delTeam` + propsToStr(props)
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editTeamAdmin', teamId: jsonCommand.teamId },
        },
      ],
    }
  }
  const team = await Teams.findByIdAndRemove(jsonCommand.teamId)
  const teamUsers = await TeamsUsers.deleteMany({ teamId: jsonCommand.teamId })
  const gameTeams = await GamesTeams.deleteMany({ teamId: jsonCommand.teamId })
  return {
    success: true,
    message: 'Команда удалена',
    nextCommand: `teams`,
  }
}

export default delTeamAdmin
