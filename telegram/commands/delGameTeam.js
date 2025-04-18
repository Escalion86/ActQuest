import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getAdmins from 'telegram/func/getAdmins'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'
import sendMessage from 'telegram/sendMessage'

const delGameTeam = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId, db)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId, db)
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
  await db.model('GamesTeams').findByIdAndDelete(jsonCommand.gameTeamId)

  // Оповещаем администраторов
  const admins = await getAdmins(db)
  const adminTelegramIds = admins.map(({ telegramId }) => telegramId)

  const team = await getTeam(gameTeam.teamId, db)
  if (team.success === false) return team

  await Promise.all(
    adminTelegramIds.map(async (telegramId) => {
      await sendMessage({
        chat_id: telegramId,
        text: `Команда "${team.name}" отписалась от игры ${formatGameName(
          game
        )}`,
        // keyboard,
        location,
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
