import getNoun from '@helpers/getNoun'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

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
      const findedCodes =
        gameTeam.findedCodes.length >= startedTasks
          ? gameTeam.findedCodes[startedTasks - 1].length
          : 0
      const taskDuration = game.taskDuration ?? 3600

      const isTeamFinished =
        gameTeam.endTime[game.tasks.length - 1] ||
        (gameTeam.startTime[game.tasks.length - 1] &&
          getSecondsBetween(gameTeam.startTime[game.tasks.length - 1]) >
            taskDuration)

      if (isTeamFinished) return `"${team.name}" - завершили все задания`

      const task = game.tasks[startedTasks - 1]

      return `"${team.name}" - выполняют задание №${startedTasks} "${
        task.title
      }".${
        findedCodes > 0
          ? `\nНайдено ${getNoun(findedCodes, 'код', 'кода', 'кодов')}`
          : ''
      }`
    })
    .join('\n\n')

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
    message: `<b>Состояние игры "${game.name}":</b>\n${text}`,
    buttons: [
      {
        text: '\u{1F504} Обновить статус игры',
        c: { c: 'gameStatus', gameId: jsonCommand.gameId },
      },
      {
        text: '\u{2B05} Назад',
        c: { c: 'editGame', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default gameStatus
