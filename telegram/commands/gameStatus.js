import getSecondsBetween from '@helpers/getSecondsBetween'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import { CLUE_DURATION_SEC } from 'telegram/constants'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import secondsToTime from 'telegram/func/secondsToTime'

const gameStatus = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (game.status !== 'started') {
    return {
      message: 'Игра должна быть в процессе',
      nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
    }
  }

  // Получаем список команд участвующих в игре
  const gameTeams = await GamesTeams.find({
    gameId: jsonCommand.gameId,
  })

  const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })

  const text = teams
    .map((team) => {
      const gameTeam = gameTeams.find(
        (gameTeam) => gameTeam.teamId === String(team._id)
      )
      var startedTasks = 0
      gameTeam.startTime.forEach((time) => {
        if (time) ++startedTasks
      })

      if (startedTasks === gameTeam.startTime.length)
        return `"${team.name}" - завершили`

      return `"${team.name}" - на ${startedTasks} задании`
    })
    .join('\n')

  // const tasksDuration = gameTeams.map((gameTeam) => ({
  //   teamId: gameTeam.teamId,
  //   duration: durationCalc(gameTeam),
  // }))

  // const text = game.tasks.map((task, index) => {
  //   return `\n\n<b>Задание "${task.title}"</b>${teams.map((team) => {
  //     const dur = tasksDuration.find((item) => item.teamId === String(team._id))
  //     return `\n- ${team.name} - ${secondsToTime(dur?.duration[index])}`
  //   })}`
  // })

  return {
    message: `<b>Состояние игры:</b>\n${text}`,
    buttons: [
      {
        text: '\u{2B05} Назад',
        c: 'editGame',
        gameId: jsonCommand.gameId,
      },
    ],
  }
}

export default gameStatus
