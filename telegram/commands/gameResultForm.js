import formatGameDateTimeFact from '@helpers/formatGameDateTimeFact'
import getSecondsBetween from '@helpers/getSecondsBetween'
import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import moment from 'moment-timezone'
import { CLUE_DURATION_SEC } from 'telegram/constants'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import secondsToTime from 'telegram/func/secondsToTime'

const sortFunc = (a, b, key = 'seconds', direction = 'ASC') => {
  const isNumericA = typeof a[key] === 'number'
  const isNumericB = typeof b[key] === 'number'

  if (isNumericA && isNumericB) {
    if (direction === 'ASC') return a[key] - b[key]
    return b[key] - a[key]
  }

  if (isNumericA && !isNumericB) {
    return direction === 'ASC' ? -1 : 1
  }

  if (!isNumericA && isNumericB) {
    return direction === 'ASC' ? 1 : -1
  }
  return 0
}

const getAverage = (numbers) =>
  Math.round(numbers.reduce((acc, number) => acc + number, 0) / numbers.length)

const durationCalc = ({ startTime, endTime, activeNum }) => {
  if (!startTime || !endTime) return null
  const tempArray = []
  for (let i = 0; i < startTime.length; i++) {
    if (activeNum > i) {
      if (!endTime[i]) tempArray.push(CLUE_DURATION_SEC * 3)
      else tempArray.push(getSecondsBetween(startTime[i], endTime[i]))
    } else if (activeNum === i) {
      tempArray.push('[не завершено]')
    } else {
      tempArray.push('[не начато]')
    }
  }
  return tempArray
}

const gameResultForm = async ({ telegramId, jsonCommand }) => {
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

  const teamsUsers = await TeamsUsers.find({
    teamId: { $in: teamsIds },
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
        const seconds = dur?.duration[index] ?? '[не начато]'
        if (!fastestTask.seconds || fastestTask.seconds > seconds) {
          fastestTask.seconds = seconds
          fastestTask.teamName = team.name
          fastestTask.taskTitle = task?.title
        }
        return { team, seconds }
      })

      taskAverageTimes[index] = getAverage(
        teamsSeconds
          .filter(({ seconds }) => typeof seconds === 'number')
          .map(({ seconds }) => seconds)
      )

      const sortedTeamsSeconds = [...teamsSeconds].sort(sortFunc)

      return `\n<b>\u{1F4CC} "${task?.title}"</b>\n${sortedTeamsSeconds
        .map(
          ({ team, seconds }) =>
            `${
              typeof seconds === 'number' ? secondsToTime(seconds) : seconds
            } - ${team.name}`
        )
        .join('\n')}`
    })
    .join('\n')

  const totalTeamsSeconds = teams.map((team, index) => {
    const dur = tasksDuration.find((item) => item.teamId === String(team._id))
    let penalty = 0
    let result = 0
    const seconds = dur?.duration.reduce((partialSum, a) => {
      const res =
        typeof a === 'number' && typeof partialSum === 'number'
          ? partialSum + a
          : '[стоп игра]'
      if (a > 3500) console.log('a :>> ', a)
      if (typeof res === 'string' || a >= (game.taskDuration ?? 3600)) {
        penalty += game.taskFailurePenalty ?? 0
        result += game.taskDuration ?? 3600
      } else result += a
      return res
    }, 0)
    result += penalty

    return { team, seconds, penalty, result }
  })

  const sortedTotalTeamsSeconds = [...totalTeamsSeconds].sort(sortFunc)
  const sortedTotalTeamsPenalty = [...totalTeamsSeconds].sort((a, b) =>
    sortFunc(a, b, 'penalty', 'DESC')
  )
  const sortedTotalTeamsResult = [...totalTeamsSeconds].sort((a, b) =>
    sortFunc(a, b, 'result')
  )

  const totalTeamsWithPenalty = sortedTotalTeamsPenalty.filter(
    ({ penalty }) => penalty > 0
  )
  const totalPenalty = totalTeamsWithPenalty
    .map(({ team, penalty }) => {
      return `${secondsToTime(penalty)} - ${team.name}`
    })
    .join('\n')

  const totalSeconds = sortedTotalTeamsSeconds
    .map(({ team, seconds }) => {
      return `${
        typeof seconds === 'number' ? secondsToTime(seconds) : seconds
      } - ${team.name}`
    })
    .join('\n')

  const totalResult = sortedTotalTeamsResult
    .map(({ team, result }) => {
      return `${secondsToTime(result)} - ${team.name}`
    })
    .join('\n')

  const mostEasyTaskIndex = taskAverageTimes.indexOf(
    Math.min.apply(null, taskAverageTimes)
  )
  const mostHardTaskIndex = taskAverageTimes.indexOf(
    Math.max.apply(null, taskAverageTimes)
  )

  const gameDateTimeFact = formatGameDateTimeFact(game, {
    dontShowDayOfWeek: false,
    fullWeek: false,
    // showYear,
    // fullMonth,
    // weekInBrackets,
    showDuration: true,
    durationOnNextLine: true,
    showSeconds: true,
  })

  await dbConnect()
  // const game = await Games.findById(jsonCommand.gameId)
  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    result: {
      text: `<b>Результаты игры:\n${formatGameName(
        game
      )}</b>\n\n<b>Фактический период игры</b>:\n${gameDateTimeFact}\n${text}\n\n\n${
        game.taskFailurePenalty
          ? `<b>\u{2B50}РЕЗУЛЬТАТЫ:</b>\n<b>\u{231A}Без учета штрафов:</b>\n${totalSeconds}\n\n<b>\u{1F534} Штрафы:</b>\n${totalPenalty}\n\n`
          : ''
      }<b>\u{1F3C6} ИТОГО:</b>\n${totalResult}\n\n\n<b>\u{1F607} Самое легкое задание:</b>\n"${
        game.tasks[mostEasyTaskIndex]?.title
      }" - среднее время ${secondsToTime(
        taskAverageTimes[mostEasyTaskIndex]
      )}\n\n<b>\u{1F608} Самое сложное задание:</b>\n"${
        game.tasks[mostHardTaskIndex]?.title
      }" - среднее время ${secondsToTime(
        taskAverageTimes[mostHardTaskIndex]
      )}\n\n<b>\u{1F680} Самое быстрое выполнение задания:</b>\n"${
        fastestTask.taskTitle
      }" команда "${fastestTask.teamName}" - ${secondsToTime(
        fastestTask.seconds
      )}`,
      teams,
      gameTeams,
      teamsUsers,
    },
  })

  return {
    message: `Результаты игры ${formatGameName(game)} сформированы!`,
    buttons: [
      {
        c: { c: 'gameResult', gameId: jsonCommand.gameId },
        text: '\u{1F4CB} Посмотреть результаты игры',
        hide: game.status !== 'finished',
      },
      {
        text: '\u{2B05} Назад',
        c: { c: 'editGame', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default gameResultForm
