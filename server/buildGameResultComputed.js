import getSecondsBetween from '@helpers/getSecondsBetween'
import { toStringId } from '@helpers/idAndDate'

const secondsToTime = (sec) => {
  const numeric = Number(sec)
  if (!Number.isFinite(numeric)) {
    return null
  }

  const abs = Math.abs(Math.round(numeric))
  const hours = Math.floor(abs / 3600)
  const minutes = Math.floor((abs % 3600) / 60)
  const seconds = abs % 60
  const prefix = numeric < 0 ? '-' : ''
  const pad = (value) => String(value).padStart(2, '0')
  return `${prefix}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

const isNumeric = (value) => typeof value === 'number' && Number.isFinite(value)

const toDate = (value) => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const sortByOptionalNumber = (first, second, key) => {
  const a = first?.[key]
  const b = second?.[key]

  const aNumeric = isNumeric(a)
  const bNumeric = isNumeric(b)

  if (aNumeric && bNumeric) {
    return a - b
  }
  if (aNumeric && !bNumeric) {
    return -1
  }
  if (!aNumeric && bNumeric) {
    return 1
  }
  return 0
}

const getTaskIdValue = (task) =>
  task?._id !== null && task?._id !== undefined ? String(task._id) : ''

const isCaptainForceClueAdding = (item) => {
  const source = typeof item?.source === 'string' ? item.source.trim() : ''
  const name = typeof item?.name === 'string' ? item.name.trim() : ''
  return source === 'captain_force_clue' || name.startsWith('Досрочная подсказка')
}

const hasTimeAddingTaskBinding = (item) => {
  const hasTaskId = typeof item?.taskId === 'string' && item.taskId.trim()
  const hasTaskIndex = Number.isInteger(Number(item?.taskIndex))
  return Boolean(hasTaskId || hasTaskIndex)
}

const normalizeTimeAddingScope = (item) => {
  const rawScope = typeof item?.scope === 'string' ? item.scope.trim() : ''
  if (isCaptainForceClueAdding(item) && hasTimeAddingTaskBinding(item)) {
    return 'task_elapsed'
  }
  if (rawScope === 'task_elapsed') return 'task_elapsed'
  if (rawScope === 'total_adjustment') return 'total_adjustment'
  return 'total_adjustment'
}

const shouldShowTimeAddingInAdjustments = (item) => {
  const scope = normalizeTimeAddingScope(item)
  if (isCaptainForceClueAdding(item)) return false
  if (scope === 'total_adjustment') return true
  if (typeof item?.showInAdjustments === 'boolean') {
    return item.showInAdjustments
  }
  return !isCaptainForceClueAdding(item)
}

const normalizeTimeAddingTaskIndex = (item) =>
  Number.isInteger(Number(item?.taskIndex)) ? Number(item.taskIndex) : null

const isTimeAddingForTask = (item, taskIndex, task) => {
  const itemTaskId = typeof item?.taskId === 'string' ? item.taskId.trim() : ''
  const taskId = getTaskIdValue(task)
  if (taskId && itemTaskId) return itemTaskId === taskId
  return normalizeTimeAddingTaskIndex(item) === taskIndex
}

const getTaskElapsedAdjustmentSeconds = (gameTeam, taskIndex, task) => {
  const addings = Array.isArray(gameTeam?.timeAddings)
    ? gameTeam.timeAddings
    : []

  return addings.reduce((sum, item) => {
    if (normalizeTimeAddingScope(item) !== 'task_elapsed') return sum
    if (!isTimeAddingForTask(item, taskIndex, task)) return sum
    const seconds = Number(item?.time)
    return Number.isFinite(seconds) ? sum + Math.round(seconds) : sum
  }, 0)
}

const buildTaskDurations = (gameTeam, game) => {
  const tasksCount = Array.isArray(game?.tasks) ? game.tasks.length : 0
  const taskDuration = Number(game?.taskDuration) || 3600
  const startTime = Array.isArray(gameTeam?.startTime) ? gameTeam.startTime : []
  const endTime = Array.isArray(gameTeam?.endTime) ? gameTeam.endTime : []
  const taskFailures = Array.isArray(gameTeam?.taskFailures)
    ? gameTeam.taskFailures
    : []
  const activeNum = Number(gameTeam?.activeNum) || 0

  const result = []

  for (let index = 0; index < tasksCount; index += 1) {
    const isFailedByDecision = taskFailures.some(
      (item) => Number(item?.taskIndex) === index && item?.failedAt,
    )

    const taskElapsedAdjustmentSeconds = getTaskElapsedAdjustmentSeconds(
      gameTeam,
      index,
      Array.isArray(game?.tasks) ? game.tasks[index] : null,
    )
    const applyTaskElapsedAdjustment = (seconds) =>
      Math.max(0, Math.min(taskDuration, seconds + taskElapsedAdjustmentSeconds))

    if (activeNum > index) {
      if (!endTime[index]) {
        result.push(taskDuration)
      } else {
        result.push(
          applyTaskElapsedAdjustment(
            getSecondsBetween(startTime[index], endTime[index]),
          ),
        )
      }
      continue
    }

    if (activeNum === index) {
      if (isFailedByDecision) {
        result.push(taskDuration)
        continue
      }
      result.push('[не завершено]')
      continue
    }

    result.push('[не начато]')
  }

  return result
}

const getPhotoTaskChecks = (gameTeam, taskIndex) => {
  const photos = Array.isArray(gameTeam?.photos) ? gameTeam.photos : []
  const taskPhotos = photos[taskIndex]
  const checksRaw = taskPhotos?.checks

  if (checksRaw && typeof checksRaw.get === 'function') {
    const checksObject = {}
    Array.from(checksRaw.entries()).forEach(([key, value]) => {
      checksObject[String(key)] = Boolean(value)
    })
    return checksObject
  }

  if (checksRaw && typeof checksRaw === 'object') {
    return Object.keys(checksRaw).reduce((acc, key) => {
      acc[key] = Boolean(checksRaw[key])
      return acc
    }, {})
  }

  return {}
}

const getTaskPenaltyAndBonus = (task, gameTeam, taskIndex) => {
  const findedPenaltyCodes = Array.isArray(gameTeam?.findedPenaltyCodes)
    ? gameTeam.findedPenaltyCodes
    : []
  const findedBonusCodes = Array.isArray(gameTeam?.findedBonusCodes)
    ? gameTeam.findedBonusCodes
    : []

  const penaltyFoundOnTask = Array.isArray(findedPenaltyCodes[taskIndex])
    ? findedPenaltyCodes[taskIndex]
    : []
  const bonusFoundOnTask = Array.isArray(findedBonusCodes[taskIndex])
    ? findedBonusCodes[taskIndex]
    : []

  const penaltyCodes = Array.isArray(task?.penaltyCodes)
    ? task.penaltyCodes
    : []
  const bonusCodes = Array.isArray(task?.bonusCodes) ? task.bonusCodes : []

  const penaltyItems = penaltyCodes
    .filter((item) => penaltyFoundOnTask.includes(item?.code))
    .map((item) => ({
      type: 'penalty',
      seconds: Number(item?.penalty) || 0,
      description:
        typeof item?.description === 'string' ? item.description : '',
      code: item?.code || '',
    }))
    .filter((item) => item.seconds > 0)

  const bonusItems = bonusCodes
    .filter((item) => bonusFoundOnTask.includes(item?.code))
    .map((item) => ({
      type: 'bonus',
      seconds: Number(item?.bonus) || 0,
      description:
        typeof item?.description === 'string' ? item.description : '',
      code: item?.code || '',
    }))
    .filter((item) => item.seconds > 0)

  const penaltySeconds = penaltyItems.reduce(
    (acc, item) => acc + item.seconds,
    0,
  )
  const bonusSeconds = bonusItems.reduce((acc, item) => acc + item.seconds, 0)

  return {
    penaltyItems,
    bonusItems,
    penaltySeconds,
    bonusSeconds,
  }
}

const getWrongCodePenalty = (game, gameTeam, taskIndex) => {
  const manyCodesPenalty = Array.isArray(game?.manyCodesPenalty)
    ? game.manyCodesPenalty
    : null

  if (!manyCodesPenalty || manyCodesPenalty.length < 2) {
    return 0
  }

  const maxCodes = Number(manyCodesPenalty[0]) || 0
  const penaltyForMaxCodes = Number(manyCodesPenalty[1]) || 0
  if (maxCodes <= 0 || penaltyForMaxCodes <= 0) {
    return 0
  }

  const wrongCodes = Array.isArray(gameTeam?.wrongCodes)
    ? gameTeam.wrongCodes
    : []
  const wrongCodesOnTask = Array.isArray(wrongCodes[taskIndex])
    ? wrongCodes[taskIndex]
    : []

  if (wrongCodesOnTask.length < maxCodes) {
    return 0
  }

  return Math.floor(wrongCodesOnTask.length / maxCodes) * penaltyForMaxCodes
}

const buildEmptyTeamResult = (team, game) => {
  const taskDuration = Number(game?.taskDuration) || 3600
  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const teamId = toStringId(team?._id ?? team?.id) || ''

  const taskResults = tasks.map((task, taskIndex) => ({
    taskIndex,
    taskTitle: typeof task?.title === 'string' ? task.title : '',
    isBonusTask: Boolean(task?.isBonusTask),
    canceled: Boolean(task?.canceled),
    status: 'not_started',
    raw: '[не начато]',
    seconds: null,
    normalizedSeconds: task?.isBonusTask || task?.canceled ? 0 : taskDuration,
    penaltySeconds: 0,
    bonusSeconds: 0,
    manyWrongCodePenaltySeconds: 0,
    adjustments: [],
    display: '[не начато]',
  }))

  const baseSeconds = taskResults.reduce((acc, taskResult) => {
    if (taskResult.isBonusTask || taskResult.canceled) {
      return acc
    }
    return acc + taskResult.normalizedSeconds
  }, 0)

  return {
    teamId,
    teamName:
      typeof team?.name === 'string' && team.name.trim()
        ? team.name.trim()
        : 'Без названия',
    baseSeconds,
    baseDisplay: '[стоп игра]',
    hasStopGame: true,
    failurePenaltySeconds: 0,
    codePenaltySeconds: 0,
    codeBonusSeconds: 0,
    manyWrongCodePenaltySeconds: 0,
    addingsSeconds: 0,
    addings: [],
    finalSeconds: baseSeconds,
    finalDisplay: secondsToTime(baseSeconds) || '00:00:00',
    taskResults,
    place: null,
  }
}

const buildTeamResult = (team, gameTeam, game) => {
  if (!gameTeam) {
    return buildEmptyTeamResult(team, game)
  }

  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const taskDuration = Number(game?.taskDuration) || 3600
  const taskFailurePenalty = Number(game?.taskFailurePenalty) || 0
  const durations = buildTaskDurations(gameTeam, game)

  let baseSeconds = 0
  let failurePenaltySeconds = 0
  let codePenaltySeconds = 0
  let codeBonusSeconds = 0
  let manyWrongCodePenaltySeconds = 0
  let hasStopGame = false

  const taskResults = tasks.map((task, taskIndex) => {
    const raw = durations[taskIndex] ?? '[не начато]'
    const numericDuration = isNumeric(raw) ? raw : null
    const isCanceled = Boolean(task?.canceled)
    const isBonusTask = Boolean(task?.isBonusTask)
    const shouldCountInTotals = !isCanceled && !isBonusTask

    const normalizedSeconds = shouldCountInTotals
      ? numericDuration === null
        ? taskDuration
        : numericDuration
      : 0

    if (shouldCountInTotals) {
      baseSeconds += normalizedSeconds
    }

    let status = 'completed'
    if (raw === '[не начато]') {
      status = 'not_started'
      hasStopGame = true
    } else if (raw === '[не завершено]') {
      status = 'in_progress'
      hasStopGame = true
    } else if (numericDuration === null) {
      status = 'stopped'
      hasStopGame = true
    }

    let taskFailurePenaltySeconds = 0
    if (
      shouldCountInTotals &&
      (numericDuration === null || normalizedSeconds >= taskDuration)
    ) {
      taskFailurePenaltySeconds = taskFailurePenalty
      failurePenaltySeconds += taskFailurePenaltySeconds
    }

    const codeResult = getTaskPenaltyAndBonus(task, gameTeam, taskIndex)
    const wrongCodePenaltySeconds = getWrongCodePenalty(
      game,
      gameTeam,
      taskIndex,
    )

    codePenaltySeconds += codeResult.penaltySeconds
    codeBonusSeconds += codeResult.bonusSeconds
    manyWrongCodePenaltySeconds += wrongCodePenaltySeconds

    const adjustments = [
      ...codeResult.penaltyItems.map((item) => ({
        ...item,
        display: secondsToTime(item.seconds),
      })),
      ...codeResult.bonusItems.map((item) => ({
        ...item,
        display: secondsToTime(item.seconds),
      })),
    ]

    if (wrongCodePenaltySeconds > 0) {
      adjustments.push({
        type: 'penalty',
        code: 'many_wrong_codes',
        description: 'Подбор кода',
        seconds: wrongCodePenaltySeconds,
        display: secondsToTime(wrongCodePenaltySeconds),
      })
    }

    if (taskFailurePenaltySeconds > 0) {
      adjustments.push({
        type: 'penalty',
        code: 'task_failure',
        description: 'Задание не выполнено',
        seconds: taskFailurePenaltySeconds,
        display: secondsToTime(taskFailurePenaltySeconds),
      })
    }

    return {
      taskIndex,
      taskTitle: typeof task?.title === 'string' ? task.title : '',
      isBonusTask,
      canceled: isCanceled,
      status,
      raw,
      seconds: numericDuration,
      normalizedSeconds,
      penaltySeconds:
        taskFailurePenaltySeconds +
        codeResult.penaltySeconds +
        wrongCodePenaltySeconds,
      bonusSeconds: codeResult.bonusSeconds,
      manyWrongCodePenaltySeconds: wrongCodePenaltySeconds,
      adjustments,
      display: numericDuration === null ? raw : secondsToTime(numericDuration),
    }
  })

  const addings = Array.isArray(gameTeam?.timeAddings)
    ? gameTeam.timeAddings
        .filter((item) => shouldShowTimeAddingInAdjustments(item))
        .map((item) => {
          const seconds = Number(item?.time)
          if (!Number.isFinite(seconds) || seconds === 0) {
            return null
          }
          return {
            type: seconds > 0 ? 'penalty' : 'bonus',
            seconds,
            absSeconds: Math.abs(seconds),
            display: secondsToTime(Math.abs(seconds)),
            name: typeof item?.name === 'string' ? item.name : '',
            taskId: item?.taskId || null,
            taskIndex: Number.isFinite(Number(item?.taskIndex))
              ? Number(item.taskIndex)
              : null,
            scope: normalizeTimeAddingScope(item),
            showInAdjustments: shouldShowTimeAddingInAdjustments(item),
          }
        })
        .filter(Boolean)
    : []

  const addingsSeconds = addings.reduce(
    (acc, item) =>
      item.scope === 'total_adjustment' ? acc + item.seconds : acc,
    0,
  )
  const finalSeconds =
    baseSeconds +
    failurePenaltySeconds +
    codePenaltySeconds +
    manyWrongCodePenaltySeconds -
    codeBonusSeconds +
    addingsSeconds

  const teamId =
    toStringId(team?._id ?? team?.id) || toStringId(gameTeam?.teamId) || ''

  return {
    teamId,
    teamName:
      typeof team?.name === 'string' && team.name.trim()
        ? team.name.trim()
        : 'Без названия',
    baseSeconds,
    baseDisplay: hasStopGame
      ? '[стоп игра]'
      : secondsToTime(baseSeconds) || '00:00:00',
    hasStopGame,
    failurePenaltySeconds,
    codePenaltySeconds,
    codeBonusSeconds,
    manyWrongCodePenaltySeconds,
    addingsSeconds,
    addings,
    finalSeconds,
    finalDisplay: secondsToTime(finalSeconds) || '00:00:00',
    taskResults,
    place: null,
  }
}

const buildPhotoTeamResult = (team, gameTeam, game) => {
  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const taskFailurePenalty = Number(game?.taskFailurePenalty) || 0
  const addings = Array.isArray(gameTeam?.timeAddings)
    ? gameTeam.timeAddings
        .filter((item) => shouldShowTimeAddingInAdjustments(item))
        .map((item) => {
          const value = Number(item?.time)
          if (!Number.isFinite(value) || value === 0) {
            return null
          }

          // В фотоквесте +time трактуем как штраф (минус баллы), -time как бонус (плюс баллы)
          const points = value > 0 ? -value : Math.abs(value)
          return {
            type: value > 0 ? 'penalty' : 'bonus',
            points,
            absPoints: Math.abs(points),
            name: typeof item?.name === 'string' ? item.name : '',
            taskId: item?.taskId || null,
            taskIndex: Number.isFinite(Number(item?.taskIndex))
              ? Number(item.taskIndex)
              : null,
            scope: normalizeTimeAddingScope(item),
            showInAdjustments: shouldShowTimeAddingInAdjustments(item),
          }
        })
        .filter(Boolean)
    : []

  let taskPoints = 0
  let subTaskPoints = 0
  let failurePenaltyPoints = 0
  let codePenaltyPoints = 0
  let codeBonusPoints = 0
  let manyWrongCodePenaltyPoints = 0

  const taskResults = tasks.map((task, taskIndex) => {
    const isCanceled = Boolean(task?.canceled)
    const checks = getPhotoTaskChecks(gameTeam, taskIndex)
    const accepted = Boolean(checks?.accepted)

    const baseTaskPoints = accepted
      ? Number(task?.taskBonusForComplite) || 0
      : 0
    const taskSubTasks = Array.isArray(task?.subTasks) ? task.subTasks : []
    const acceptedSubTaskPoints = accepted
      ? taskSubTasks.reduce((acc, subTask) => {
          const subTaskId = toStringId(subTask?._id)
          if (!subTaskId || !checks[subTaskId]) {
            return acc
          }
          return acc + (Number(subTask?.bonus) || 0)
        }, 0)
      : 0

    const codeResult = getTaskPenaltyAndBonus(task, gameTeam, taskIndex)
    const wrongCodePenalty = getWrongCodePenalty(game, gameTeam, taskIndex)
    const taskFailurePoints = !isCanceled && !accepted ? taskFailurePenalty : 0

    taskPoints += baseTaskPoints
    subTaskPoints += acceptedSubTaskPoints
    failurePenaltyPoints += taskFailurePoints
    codePenaltyPoints += codeResult.penaltySeconds
    codeBonusPoints += codeResult.bonusSeconds
    manyWrongCodePenaltyPoints += wrongCodePenalty

    const resultPoints =
      baseTaskPoints +
      acceptedSubTaskPoints +
      (Number(codeResult.bonusSeconds) || 0) -
      (Number(codeResult.penaltySeconds) || 0) -
      wrongCodePenalty -
      taskFailurePoints

    return {
      taskIndex,
      taskTitle: typeof task?.title === 'string' ? task.title : '',
      accepted,
      canceled: isCanceled,
      taskPoints: baseTaskPoints,
      subTaskPoints: acceptedSubTaskPoints,
      failurePenaltyPoints: taskFailurePoints,
      codePenaltyPoints: Number(codeResult.penaltySeconds) || 0,
      codeBonusPoints: Number(codeResult.bonusSeconds) || 0,
      manyWrongCodePenaltyPoints: wrongCodePenalty,
      resultPoints,
      display: `${resultPoints} б.`,
    }
  })

  const addingsPoints = addings.reduce(
    (acc, item) =>
      item.scope === 'total_adjustment'
        ? acc + (Number(item.points) || 0)
        : acc,
    0,
  )
  const finalPoints =
    taskPoints +
    subTaskPoints +
    codeBonusPoints -
    codePenaltyPoints -
    manyWrongCodePenaltyPoints -
    failurePenaltyPoints +
    addingsPoints

  const teamId =
    toStringId(team?._id ?? team?.id) || toStringId(gameTeam?.teamId) || ''

  return {
    teamId,
    teamName:
      typeof team?.name === 'string' && team.name.trim()
        ? team.name.trim()
        : 'Без названия',
    scoringMode: 'points',
    taskPoints,
    subTaskPoints,
    failurePenaltyPoints,
    codePenaltyPoints,
    codeBonusPoints,
    manyWrongCodePenaltyPoints,
    addingsPoints,
    addings,
    finalPoints,
    finalDisplay: `${finalPoints} б.`,
    taskResults,
    place: null,
  }
}

const buildTaskBoards = (teamsResults, game) => {
  const tasks = Array.isArray(game?.tasks) ? game.tasks : []

  return tasks.map((task, taskIndex) => {
    const entries = teamsResults
      .map((teamResult) => {
        const taskResult = teamResult.taskResults[taskIndex]
        if (!taskResult) {
          return null
        }
        return {
          teamId: teamResult.teamId,
          teamName: teamResult.teamName,
          status: taskResult.status,
          seconds: taskResult.seconds,
          display: taskResult.display,
          penaltySeconds: Number(taskResult.penaltySeconds) || 0,
          bonusSeconds: Number(taskResult.bonusSeconds) || 0,
          adjustments: Array.isArray(taskResult.adjustments)
            ? taskResult.adjustments
            : [],
        }
      })
      .filter(Boolean)
      .sort((first, second) => {
        const compare = sortByOptionalNumber(first, second, 'seconds')
        if (compare !== 0) {
          return compare
        }
        return first.teamName.localeCompare(second.teamName, 'ru')
      })

    const numericSeconds = entries
      .map((entry) => entry.seconds)
      .filter((seconds) => isNumeric(seconds))

    const averageSeconds =
      numericSeconds.length > 0
        ? Math.round(
            numericSeconds.reduce((acc, value) => acc + value, 0) /
              numericSeconds.length,
          )
        : null

    return {
      taskIndex,
      title: typeof task?.title === 'string' ? task.title : '',
      canceled: Boolean(task?.canceled),
      isBonusTask: Boolean(task?.isBonusTask),
      averageSeconds,
      averageDisplay: isNumeric(averageSeconds)
        ? secondsToTime(averageSeconds)
        : null,
      entries,
    }
  })
}

const buildHighlights = (taskBoards) => {
  const applicable = taskBoards.filter(
    (board) => !board.canceled && !board.isBonusTask,
  )

  const easiestTask = [...applicable]
    .filter((board) => isNumeric(board.averageSeconds))
    .sort((first, second) => first.averageSeconds - second.averageSeconds)[0]

  const hardestTask = [...applicable]
    .filter((board) => isNumeric(board.averageSeconds))
    .sort((first, second) => second.averageSeconds - first.averageSeconds)[0]

  let fastestCompletion = null
  applicable.forEach((board) => {
    board.entries.forEach((entry) => {
      if (!isNumeric(entry.seconds)) {
        return
      }

      if (!fastestCompletion || entry.seconds < fastestCompletion.seconds) {
        fastestCompletion = {
          taskIndex: board.taskIndex,
          taskTitle: board.title,
          teamId: entry.teamId,
          teamName: entry.teamName,
          seconds: entry.seconds,
          display: secondsToTime(entry.seconds),
        }
      }
    })
  })

  return {
    easiestTask: easiestTask
      ? {
          taskIndex: easiestTask.taskIndex,
          taskTitle: easiestTask.title,
          averageSeconds: easiestTask.averageSeconds,
          averageDisplay: easiestTask.averageDisplay,
        }
      : null,
    hardestTask: hardestTask
      ? {
          taskIndex: hardestTask.taskIndex,
          taskTitle: hardestTask.title,
          averageSeconds: hardestTask.averageSeconds,
          averageDisplay: hardestTask.averageDisplay,
        }
      : null,
    fastestCompletion,
  }
}

const resolveGameDuration = ({ game, gameTeams }) => {
  const factStart = toDate(game?.dateStartFact)
  const factEnd = toDate(game?.dateEndFact)

  let startedAt = factStart
  let endedAt = factEnd

  if (!startedAt || !endedAt) {
    const allStarts = []
    const allEnds = []

    gameTeams.forEach((gameTeam) => {
      const starts = Array.isArray(gameTeam?.startTime)
        ? gameTeam.startTime
        : []
      const ends = Array.isArray(gameTeam?.endTime) ? gameTeam.endTime : []

      starts.forEach((value) => {
        const date = toDate(value)
        if (date) {
          allStarts.push(date)
        }
      })

      ends.forEach((value) => {
        const date = toDate(value)
        if (date) {
          allEnds.push(date)
        }
      })
    })

    if (!startedAt && allStarts.length > 0) {
      startedAt = new Date(Math.min(...allStarts.map((item) => item.getTime())))
    }

    if (!endedAt) {
      const endCandidates = allEnds.length > 0 ? allEnds : allStarts
      if (endCandidates.length > 0) {
        endedAt = new Date(
          Math.max(...endCandidates.map((item) => item.getTime())),
        )
      }
    }
  }

  if (!startedAt || !endedAt) {
    return {
      gameDurationSeconds: null,
      gameDurationDisplay: null,
      gameStartedAt: startedAt ? startedAt.toISOString() : null,
      gameEndedAt: endedAt ? endedAt.toISOString() : null,
    }
  }

  const gameDurationSeconds = getSecondsBetween(startedAt, endedAt)

  return {
    gameDurationSeconds,
    gameDurationDisplay: secondsToTime(gameDurationSeconds),
    gameStartedAt: startedAt.toISOString(),
    gameEndedAt: endedAt.toISOString(),
  }
}

const getResultSnapshots = (game) => {
  const currentResult =
    game?.result && typeof game.result === 'object' ? game.result : {}
  const hasTeams =
    Array.isArray(currentResult?.teams) && currentResult.teams.length > 0
  const hasGameTeams =
    Array.isArray(currentResult?.gameTeams) &&
    currentResult.gameTeams.length > 0
  const hasTeamsUsers =
    Array.isArray(currentResult?.teamsUsers) &&
    currentResult.teamsUsers.length > 0

  if (hasTeams && hasGameTeams && hasTeamsUsers) {
    return {
      teams: currentResult.teams,
      gameTeams: currentResult.gameTeams,
      teamsUsers: currentResult.teamsUsers,
    }
  }

  const error = new Error(
    'Снапшоты результатов отсутствуют. Сначала сохраните result.teams/result.gameTeams/result.teamsUsers при остановке игры.',
  )
  error.code = 'RESULT_SNAPSHOTS_MISSING'
  throw error
}

const buildGameResultComputed = async ({ game }) => {
  const snapshots = getResultSnapshots(game)
  const teams = Array.isArray(snapshots.teams) ? snapshots.teams : []
  const gameTeams = Array.isArray(snapshots.gameTeams)
    ? snapshots.gameTeams
    : []
  const teamsUsers = Array.isArray(snapshots.teamsUsers)
    ? snapshots.teamsUsers
    : []
  const outOfCompetitionTeamIds = new Set(
    gameTeams
      .filter((item) => Boolean(item?.outOfCompetition))
      .map((item) => toStringId(item?.teamId))
      .filter(Boolean),
  )

  const isPhotoGame = game?.type === 'photo'
  const teamsResults = teams.map((team) => {
    const teamId = toStringId(team?._id ?? team?.id)
    const gameTeam = gameTeams.find(
      (item) => toStringId(item?.teamId) === teamId,
    )
    const baseResult = isPhotoGame
      ? buildPhotoTeamResult(team, gameTeam, game)
      : buildTeamResult(team, gameTeam, game)
    return {
      ...baseResult,
      outOfCompetition: Boolean(teamId && outOfCompetitionTeamIds.has(teamId)),
    }
  })

  const rankedTeams = teamsResults.filter((item) => !item?.outOfCompetition)
  const outOfCompetitionTeams = teamsResults.filter((item) =>
    Boolean(item?.outOfCompetition),
  )

  const sortedTeams = [...rankedTeams].sort((first, second) => {
    if (isPhotoGame) {
      const a = Number(first?.finalPoints)
      const b = Number(second?.finalPoints)
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
        return b - a
      }
    } else if (first.finalSeconds !== second.finalSeconds) {
      return first.finalSeconds - second.finalSeconds
    }

    return first.teamName.localeCompare(second.teamName, 'ru')
  })

  const teamsPlaces = {}
  sortedTeams.forEach((teamResult, index) => {
    const place = index + 1
    teamResult.place = place
    if (teamResult.teamId) {
      teamsPlaces[teamResult.teamId] = place
    }
  })

  outOfCompetitionTeams.forEach((teamResult) => {
    teamResult.place = null
  })

  const taskBoards = buildTaskBoards(sortedTeams, game)
  const highlights = buildHighlights(taskBoards)
  const duration = resolveGameDuration({ game, gameTeams })
  const rankedTeamIds = new Set(Object.keys(teamsPlaces))
  const rankedParticipantsCount = teamsUsers.filter((membership) =>
    rankedTeamIds.has(toStringId(membership?.teamId) || ''),
  ).length

  return {
    snapshots: {
      teams,
      gameTeams,
      teamsUsers,
    },
    teamsPlaces,
    computed: {
      version: 1,
      generatedAt: new Date().toISOString(),
      summary: {
        scoringMode: isPhotoGame ? 'points' : 'time',
        teamsCount: sortedTeams.length,
        participantsCount: rankedParticipantsCount,
        outOfCompetitionTeamsCount: outOfCompetitionTeams.length,
        tasksCount: Array.isArray(game?.tasks) ? game.tasks.length : 0,
        gameDurationSeconds: duration.gameDurationSeconds,
        gameDurationDisplay: duration.gameDurationDisplay,
        gameStartedAt: duration.gameStartedAt,
        gameEndedAt: duration.gameEndedAt,
      },
      teams: sortedTeams,
      outOfCompetitionTeams,
      taskBoards,
      highlights,
    },
  }
}

export default buildGameResultComputed
