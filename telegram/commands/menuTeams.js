import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import mainMenuButton from './menuItems/mainMenuButton'

const menuTeams = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })

  return {
    success: true,
    message: 'Меню работы с командами',
    buttonText: 'Команды',
    buttons: [
      // { command: 'editTeam', text: '\u{270F} Редактировать команду' },
      {
        cmd: 'joinedTeams',
        text: '\u{1F465} Мои команды',
        hide: !teamsUser || teamsUser.length === 0,
      },
      { cmd: 'joinTeam', text: '\u{1F517} Присоединиться к команде' },
      { cmd: 'createTeam', text: '\u{2795} Создать команду' },
      mainMenuButton,
    ],
  }
}

export default menuTeams
