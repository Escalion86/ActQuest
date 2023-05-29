import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import { MAX_TEAMS } from 'telegram/constants'
import joinedTeams from './joinedTeams'
import mainMenuButton from './menuItems/mainMenuButton'

const menuTeams = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })

  if (teamsUser.length >= MAX_TEAMS)
    return await joinedTeams({ telegramId, jsonCommand })

  return {
    success: true,
    message: 'Меню работы с командами',
    buttonText: 'Команды',
    buttons: [
      {
        cmd: 'joinedTeams',
        text: '\u{1F465} Мои команды',
        hide: !teamsUser || teamsUser.length === 0,
      },
      {
        cmd: 'joinTeam',
        text: '\u{1F517} Присоединиться к команде',
        hide: teamsUser.length < MAX_TEAMS,
      },
      {
        cmd: 'createTeam',
        text: '\u{2795} Создать команду',
        hide: teamsUser.length < MAX_TEAMS,
      },
      mainMenuButton,
    ],
  }
}

export default menuTeams
