import getSecondsBetween from '@helpers/getSecondsBetween'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import { CLUE_DURATION_SEC } from 'telegram/constants'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import secondsToTime from 'telegram/func/secondsToTime'

const getAverage = (numbers) =>
  numbers.reduce((acc, number) => acc + number, 0) / numbers.length

const durationCalc = ({ startTime, endTime, activeNum }) => {
  if (!startTime || !endTime) return null
  const tempArray = []
  for (let i = 0; i < startTime.length; i++) {
    if (activeNum < i) tempArray.push('[стоп игра]')
    else {
      if (!endTime[i] || !startTime[i]) tempArray.push(CLUE_DURATION_SEC * 3)
      else tempArray.push(getSecondsBetween(startTime[i], endTime[i]))
    }
  }
  return tempArray
}

const gameResult = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (game.status !== 'finished') {
    return {
      message: 'Игра еще не завершена',
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

  const tasksDuration = gameTeams.map((gameTeam) => ({
    teamId: gameTeam.teamId,
    duration: durationCalc(gameTeam),
  }))

  const taskAverageTimes = Array(game.tasks.length)
  const fastestTask = {}

  const text = game.tasks
    .map((task, index) => {
      const teamsSeconds = teams.map((team) => {
        const dur = tasksDuration.find(
          (item) => item.teamId === String(team._id)
        )
        const seconds = dur?.duration[index]
        if (!fastestTask.seconds || fastestTask.seconds > seconds) {
          fastestTask.seconds = seconds
          fastestTask.teamName = team.name
          fastestTask.taskTitle = task.title
        }
        return { team, seconds }
      })

      taskAverageTimes[index] = getAverage(
        teamsSeconds
          .map(({ seconds }) => seconds)
          .filter((seconds) => typeof seconds === 'number')
      )

      const sortedTeamsSeconds = [...teamsSeconds].sort((a, b) =>
        a.seconds < b.seconds ? -1 : 1
      )

      return `\n<b>\u{1F4CC} "${task.title}"</b>\n${sortedTeamsSeconds
        .map(
          ({ team, seconds }) =>
            `${
              typeof seconds === 'number'
                ? secondsToTime(seconds)
                : typeof seconds === 'string'
                ? seconds
                : '[выбыли]'
            } - ${team.name}`
        )
        .join('\n')}`
    })
    .join('\n')

  const totalTeamsSeconds = [
    ...teams.map((team, index) => {
      const dur = tasksDuration.find((item) => item.teamId === String(team._id))
      const seconds = dur?.duration.reduce((partialSum, a) => partialSum + a, 0)
      return { team, seconds }
    }),
  ]
  const sortedTotalTeamsSeconds = [...totalTeamsSeconds].sort((a, b) =>
    a.seconds < b.seconds ? -1 : 1
  )

  const total = sortedTotalTeamsSeconds
    .map(({ team, seconds }) => {
      return `${secondsToTime(seconds)} - ${team.name}`
    })
    .join('\n')

  const mostEasyTaskIndex = taskAverageTimes.indexOf(
    Math.min.apply(null, taskAverageTimes)
  )
  const mostHardTaskIndex = taskAverageTimes.indexOf(
    Math.max.apply(null, taskAverageTimes)
  )

  return {
    message: `<b>Результаты игры: "${
      game.name
    }"</b>\n${text}\n\n<b>\u{2B50} ИТОГО:</b>\n${total}\n\n\n<b>\u{1F607} Самое легкое задание:</b>\n"${
      game.tasks[mostEasyTaskIndex].title
    }" - среднее время ${secondsToTime(
      taskAverageTimes[mostEasyTaskIndex]
    )}\n\n<b>\u{1F608} Самое сложное задание:</b>\n"${
      game.tasks[mostHardTaskIndex].title
    }" - среднее время ${secondsToTime(
      taskAverageTimes[mostHardTaskIndex]
    )}\n\n<b>\u{1F680} Самое быстрое выполнение задания:</b>\n"${
      fastestTask.taskTitle
    }" команда "${fastestTask.teamName}" - ${secondsToTime(
      fastestTask.seconds
    )}`,
    buttons: [
      {
        text: '\u{2B05} Назад',
        c: { c: 'game', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default gameResult
