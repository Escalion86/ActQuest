import GamesTeams from '@models/GamesTeams'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import getGameTeam from 'telegram/func/getGameTeam'

const delGameTeamAdding = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  if (!jsonCommand.addingId)
    return {
      message: 'Ошибка, не указан id бонуса/штрафа',
      nextCommand: `menuGames`,
    }

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление бонуса/штрафа',
      buttons: [
        {
          text: '\u{1F4A3} Удалить',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: { c: 'gameTeamAddings', gameTeamId: jsonCommand.gameTeamId },
        },
      ],
    }
  }

  await dbConnect()
  await GamesTeams.findByIdAndUpdate(jsonCommand.gameTeamId, {
    timeAddings: gameTeam.timeAddings.filter(
      ({ id }) => id !== jsonCommand.addingId
    ),
  })
  return {
    success: true,
    message: 'Бонус/штраф удален',
    nextCommand: { c: 'gameTeamAddings', gameTeamId: gameTeam.gameTeamId },
  }
}

export default delGameTeamAdding
