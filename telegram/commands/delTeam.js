import getNoun from '@helpers/getNoun'
import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'

const delTeam = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand.teamId, db)
  if (team.success === false) return team

  // Получаем количество игр в которых участвовала команда
  const gameTeams = await db
    .model('GamesTeams')
    .find({ teamId: jsonCommand.teamId })
  if (gameTeams.length > 0) {
    return {
      success: true,
      message: `Команда "${
        team.name
      }" не может быть удалена, так как уже участвовала в ${getNoun(
        gameTeams.length,
        'игре',
        'играх',
        'играх'
      )}`,
      buttons: [
        {
          text: '\u{1F6AB} Назад',
          c: { c: 'editTeam', teamId: jsonCommand.teamId },
        },
      ],
    }
  }

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление команды',
      buttons: [
        {
          text: '\u{1F4A3} Удалить',
          c: { confirm: true },
          // `delTeam` + propsToStr(props)
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editTeam', teamId: jsonCommand.teamId },
        },
      ],
    }
  }
  await db.model('Teams').findByIdAndRemove(jsonCommand.teamId)
  await db.model('TeamsUsers').deleteMany({ teamId: jsonCommand.teamId })
  await db.model('GamesTeams').deleteMany({ teamId: jsonCommand.teamId })

  return {
    success: true,
    message: 'Команда удалена',
    nextCommand: `menuTeams`,
  }
}

export default delTeam
