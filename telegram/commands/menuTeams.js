import { MAX_TEAMS } from 'telegram/constants'
import joinedTeams from './joinedTeams'
import mainMenuButton from './menuItems/mainMenuButton'
import isUserBan from '@helpers/isUserBan'

const menuTeams = async ({ telegramId, user, jsonCommand, location, db }) => {
  const teamsUser = await db
    .model('TeamsUsers')
    .find({ userTelegramId: telegramId })

  if (teamsUser.length >= MAX_TEAMS)
    return await joinedTeams({ telegramId, jsonCommand, location, db })

  const isBan = isUserBan(user)

  return {
    success: true,
    message: '<b>Меню работы с командами</b>',
    buttonText: 'Команды',
    buttons: [
      {
        c: 'joinedTeams',
        text: '\u{1F465} Мои команды',
        hide: !teamsUser || teamsUser.length === 0 || isBan,
      },
      {
        c: 'joinTeam',
        text: '\u{1F517} Присоединиться к команде',
        hide: teamsUser.length >= MAX_TEAMS || isBan,
      },
      {
        c: 'createTeam',
        text: '\u{2795} Создать команду',
        hide: teamsUser.length >= MAX_TEAMS || isBan,
      },
      mainMenuButton,
    ],
  }
}

export default menuTeams
