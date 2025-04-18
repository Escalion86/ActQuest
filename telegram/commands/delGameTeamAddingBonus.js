import check from 'telegram/func/check'
import getGameTeam from 'telegram/func/getGameTeam'

const delGameTeamAddingBonus = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId, db)
  if (gameTeam.success === false) return gameTeam

  if (jsonCommand.i === undefined)
    return {
      message: 'Ошибка, не указан номер бонуса',
      nextCommand: `menuGames`,
    }

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление бонуса',
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

  await db.model('GamesTeams').findByIdAndUpdate(jsonCommand.gameTeamId, {
    timeAddings: gameTeam.timeAddings.filter(
      (adding, number) => number != jsonCommand.i
    ),
  })
  return {
    success: true,
    message: 'Бонус удален',
    nextCommand: { c: 'gameTeamAddings', gameTeamId: jsonCommand.gameTeamId },
  }
}

export default delGameTeamAddingBonus
