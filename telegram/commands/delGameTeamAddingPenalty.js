import GamesTeams from '@models/GamesTeams'
import check from 'telegram/func/check'
import getGameTeam from 'telegram/func/getGameTeam'

const delGameTeamAddingPenalty = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  if (jsonCommand.i === undefined)
    return {
      message: 'Ошибка, не указан номер штрафа',
      nextCommand: `menuGames`,
    }

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление штрафа',
      buttons: [
        {
          text: '\u{1F5D1} Удалить',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: { c: 'gameTeamAddings', gameTeamId: jsonCommand.gameTeamId },
        },
      ],
    }
  }

  await GamesTeams.findByIdAndUpdate(jsonCommand.gameTeamId, {
    timeAddings: gameTeam.timeAddings.filter(
      (adding, number) => number != jsonCommand.i
    ),
  })
  return {
    success: true,
    message: 'Штраф удален',
    nextCommand: { c: 'gameTeamAddings', gameTeamId: jsonCommand.gameTeamId },
  }
}

export default delGameTeamAddingPenalty
