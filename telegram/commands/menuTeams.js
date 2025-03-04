import { MAX_TEAMS } from 'telegram/constants'
import joinedTeams from './joinedTeams'
import mainMenuButton from './menuItems/mainMenuButton'

const menuTeams = async ({ telegramId, jsonCommand, location, db }) => {
  const teamsUser = await db
    .model('TeamsUsers')
    .find({ userTelegramId: telegramId })

  if (teamsUser.length >= MAX_TEAMS)
    return await joinedTeams({ telegramId, jsonCommand })

  return {
    success: true,
    message: '<b>Меню работы с командами</b>',
    buttonText: 'Команды',
    buttons: [
      {
        c: 'joinedTeams',
        text: '\u{1F465} Мои команды',
        hide: !teamsUser || teamsUser.length === 0,
      },
      {
        c: 'joinTeam',
        text: '\u{1F517} Присоединиться к команде',
        hide: teamsUser.length >= MAX_TEAMS,
      },
      {
        c: 'createTeam',
        text: '\u{2795} Создать команду',
        hide: teamsUser.length >= MAX_TEAMS,
      },
      mainMenuButton,
    ],
  }
}

export default menuTeams
