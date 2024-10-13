import GamesTeams from '@models/GamesTeams'

import check from 'telegram/func/check'
import getGameTeam from 'telegram/func/getGameTeam'

const delGameTeamAdmin = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите отмену регистрации команды из игры',
      buttons: [
        {
          text: '\u{1F4A3} Отменить регистрацию команды из игры',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: { c: 'gameTeamAdmin', gameTeamId: jsonCommand.gameTeamId },
        },
      ],
    }
  }
  await GamesTeams.findByIdAndDelete(jsonCommand.gameTeamId)
  return {
    success: true,
    message: 'Регистрация команды на игре отменена',
    nextCommand: { c: 'gameTeamsAdmin', gameId: gameTeam.gameId },
  }
}

export default delGameTeamAdmin
