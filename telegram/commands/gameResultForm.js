import formatGameDateTimeFact from '@helpers/formatGameDateTimeFact'
import getSecondsBetween from '@helpers/getSecondsBetween'
import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
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

const durationCalc = ({ startTime, endTime, activeNum }, game) => {
  if (!startTime || !endTime) return null
  const tempArray = []
  const tasksCount = game.tasks.length
  const taskDuration = game.taskDuration ?? 3600

  for (let i = 0; i < tasksCount; i++) {
    if (activeNum > i) {
      if (!endTime[i]) tempArray.push(taskDuration)
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
    duration: durationCalc(gameTeam, game),
    findedPenaltyCodes: gameTeam.findedPenaltyCodes,
    findedBonusCodes: gameTeam.findedBonusCodes,
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
    const { teamId, duration, findedPenaltyCodes, findedBonusCodes } =
      tasksDuration.find((item) => item.teamId === String(team._id))
    let penalty = 0
    let result = 0
    let codePenalty = 0
    let codeBonus = 0
    let codePenaltyBonusText = ''
    const seconds = duration.reduce((partialSum, a) => {
      const res =
        typeof a === 'number' && typeof partialSum === 'number'
          ? partialSum + a
          : '[стоп игра]'
      if (typeof res === 'string' || a >= (game.taskDuration ?? 3600)) {
        penalty += game.taskFailurePenalty ?? 0
        result += game.taskDuration ?? 3600
      } else result += a
      return res
    }, 0)

    game.tasks.forEach(({ title, penaltyCodes, bonusCodes }, index) => {
      if (
        findedPenaltyCodes[index]?.length > 0 ||
        findedBonusCodes[index]?.length > 0
      )
        codePenaltyBonusText += `\n\u{1F4CC} "${title}":`
      if (findedPenaltyCodes[index]?.length > 0) {
        const findedPenaltyCodesFull = penaltyCodes.filter(({ code }) =>
          findedPenaltyCodes[index].includes(code)
        )
        codePenaltyBonusText += findedPenaltyCodesFull.map(
          ({ penalty, description }) =>
            `\n\u{1F534} ${secondsToTime(penalty)} - ${description}`
        )
        codePenalty += findedPenaltyCodesFull.reduce(
          (sum, { penalty }) => sum + penalty,
          0
        )
      }
      if (findedBonusCodes[index]?.length > 0) {
        const findedBonusCodesFull = bonusCodes.filter(({ code }) =>
          findedBonusCodes[index].includes(code)
        )
        codePenaltyBonusText += findedBonusCodesFull.map(
          ({ bonus, description }) =>
            `\n\u{1F7E2} ${secondsToTime(bonus)} - ${description}`
        )
        codeBonus += findedBonusCodesFull.reduce(
          (sum, { bonus }) => sum + bonus,
          0
        )
      }
    })

    result += penalty + codePenalty - codeBonus

    return {
      team,
      seconds,
      penalty,
      codePenalty,
      codeBonus,
      codePenaltyBonusText,
      result,
    }
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
  const totalCodePenaltyBonus = totalTeamsSeconds
    .map(({ team, codePenaltyBonusText }) => {
      return `Команда "${team.name}":${codePenaltyBonusText}`
    })
    .join('\n\n')

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
      )}</b>\n\n<b>Фактический период игры</b>:\n${gameDateTimeFact}\n${text}\n\n\n<b>\u{2B50}РЕЗУЛЬТАТЫ:</b>\n<b>\u{231A}Без учета бонусов и штрафов:</b>\n${totalSeconds}${
        game.taskFailurePenalty
          ? `\n\n<b>\u{1F534} Штрафы за невыполненные задания:</b>\n${
              totalPenalty ? totalPenalty : 'штрафов нет!'
            }\n\n`
          : ''
      }\n\n<b>\u{1F534} Штрафы и \u{1F7E2} бонусы за коды:</b>\n${totalCodePenaltyBonus}\n\n<b>\u{1F3C6} ИТОГО:</b>\n${totalResult}\n\n\n<b>\u{1F607} Самое легкое задание:</b>\n"${
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
