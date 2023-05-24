import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'

const delete_team = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  if (!jsonCommand.teamId)
    return {
      success: false,
      message: 'Не удалось удалить команду, так как команда не найдена',
      nextCommand: `menu_teams`,
    }
  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление команды',
      buttons: [
        {
          text: '\u{1F4A3} Удалить',
          command: { confirm: true },
          // `delete_team` + propsToStr(props)
        },
        { text: '\u{1F6AB} Отмена создания игры', command: 'menu_teams' },
      ],
    }
  }
  await dbConnect()
  const team = await Teams.findByIdAndRemove(jsonCommand.teamId)
  const teamUsers = await TeamsUsers.deleteMany({ teamId: jsonCommand.teamId })
  return {
    success: true,
    message: 'Команда удалена',
    nextCommand: `menu_teams`,
  }
}

export default delete_team
