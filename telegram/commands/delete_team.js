import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import propsToStr from 'telegram/func/propsToStr'

const delete_team = async ({ telegramId, message, props }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  if (!props.teamId)
    return {
      success: false,
      message: 'Не удалось удалить команду, так как команда не найдена',
      nextCommand: `/menu_teams`,
    }
  if (!props.confirm) {
    props.confirm = 'true'
    return {
      success: true,
      message: 'Подтвердите удаление команды',
      buttons: [
        {
          text: '\u{1F4A3} Удалить',
          command: `+confirm=true`,
          // `delete_team` + propsToStr(props)
        },
        { text: '\u{1F6AB} Отмена создания игры', command: 'menu_teams' },
      ],
    }
  }
  await dbConnect()
  const team = await Teams.findByIdAndRemove(props.teamId)
  const teamUsers = await TeamsUsers.deleteMany({ teamId: props.teamId })
  return {
    success: true,
    message: 'Команда удалена',
    nextCommand: `/menu_teams`,
  }
}

export default delete_team
