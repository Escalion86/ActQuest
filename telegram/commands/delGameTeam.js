import GamesTeams from '@models/GamesTeams'

import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getAdmins from 'telegram/func/getAdmins'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'

const delGameTeam = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: `Подтвердите отмену регистрации команды из игры ${formatGameName(
        game
      )}`,
      buttons: [
        {
          text: '\u{1F4A3} Отменить регистрацию команды из игры',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: { c: 'gameTeam', gameTeamId: jsonCommand.gameTeamId },
        },
      ],
    }
  }
  await GamesTeams.findByIdAndDelete(jsonCommand.gameTeamId)

  // Оповещаем администраторов
  const admins = await getAdmins()
  const adminTelegramIds = admins.map(({ telegramId }) => telegramId)

  await Promise.all(
    adminTelegramIds.map(async (telegramId) => {
      await sendMessage({
        chat_id: telegramId,
        text: `Команда "${team.name}" отписалась от игры ${formatGameName(
          game
        )}`,
        // keyboard,
        domen,
      })
    })
  )

  return {
    success: true,
    message: `Регистрация команды на игре ${formatGameName(game)} отменена`,
    nextCommand: { c: 'gameTeams', gameId: gameTeam.gameId },
  }
}

export default delGameTeam
