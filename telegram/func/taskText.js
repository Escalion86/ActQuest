import getSecondsBetween from '@helpers/getSecondsBetween'
import secondsToTime from './secondsToTime'
import { getNounCodes, getNounPoints } from '@helpers/getNoun'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import linkifyText from './linkifyText'
import sanitize from '@helpers/sanitize'
import { getTaskDurationSeconds, getClueTimesSeconds, getTimedCluesCountForTask } from '@helpers/taskTiming'
import { getTaskTimeAdjustmentSeconds, isTimeAddingForTask, getActiveTaskFreeze, getTimeAddingSeconds } from '@helpers/taskTimeAdjustments'

const getTaskBodyHtml = ({ taskTextValue, taskRichValue, format }) => {
  if (
    format === 'web' &&
    typeof taskRichValue === 'string' &&
    taskRichValue.trim().length > 0
  ) {
    return `<blockquote>${sanitize(taskRichValue)}</blockquote>`
  }

  return `<blockquote>${linkifyText(taskTextValue)}</blockquote>`
}

const taskText = ({
  game,
  taskNum,
  findedCodes,
  findedBonusCodes,
  findedPenaltyCodes,
  startTaskTime,
  cluesDuration = 1200,
  taskDuration = 3600,
  photos,
  timeAddings,
  visibleCluesCount,
  virtualCodesCount = 0,
  includeActionPrompt = true,
  format = 'telegram',
}) => {
  const { tasks } = game
  const taskEntry = tasks[taskNum] || {}
  taskDuration = getTaskDurationSeconds({ ...game, taskDuration }, taskEntry)
  const clueTimes = getClueTimesSeconds({ ...game, cluesDuration }, taskEntry)
  const {
    task = '',
    taskRich = '',
    codes = [],
    bonusCodes = [],
    penaltyCodes = [],
    clues = [],
    numCodesToCompliteTask,
    taskBonusForComplite,
    subTasks = [],
  } = taskEntry
  const startTaskDate =
    startTaskTime instanceof Date && !Number.isNaN(startTaskTime.getTime())
      ? startTaskTime
      : null

  const realTaskSecondsLeft = startTaskDate
    ? Math.floor(getSecondsBetween(startTaskDate))
    : 0
  const clueAdvanceSeconds = getTaskTimeAdjustmentSeconds({
    timeAddings,
    taskIndex: taskNum,
    task: taskEntry,
  })
  const taskSecondsLeft = realTaskSecondsLeft + clueAdvanceSeconds
  const freeze = getActiveTaskFreeze({ timeAddings, taskIndex: taskNum, task: taskEntry })
  const freezeRemaining = freeze ? Math.max(0, Math.ceil((new Date(freeze.createdAt).getTime() + Math.abs(freeze.time) * 1000 - Date.now()) / 1000)) : 0
  const pauseAttribute = freezeRemaining > 0 ? ` data-pause-seconds="${freezeRemaining}"` : ''

  const haveBonusCodes = bonusCodes?.length > 0
  const havePenaltyCodes = penaltyCodes?.length > 0

  const findedCodesInTask =
    typeof findedCodes === 'object' && findedCodes[taskNum]
      ? findedCodes[taskNum]
      : []
  const numOfCodesToFind = numCodesToCompliteTask ?? codes.length
  const numOfCodesToFindLeft = Math.max(0, numOfCodesToFind - findedCodesInTask.length - virtualCodesCount)

  const showCluesNum = getTimedCluesCountForTask({ ...game, cluesDuration }, taskEntry, taskSecondsLeft)
  const totalCluesCount = Array.isArray(clues) ? clues.length : 0
  const effectiveVisibleClues = Math.min(
    totalCluesCount,
    Math.max(
      0,
      Number.isInteger(visibleCluesCount)
        ? visibleCluesCount
        : Math.max(showCluesNum, 0)
    )
  )
  var cluesText = ''
  if (effectiveVisibleClues > 0)
    for (let i = 0; i < effectiveVisibleClues; i++) {
      if (clues[i]?.clue)
        cluesText += `\n\n<b>Подсказка №${i + 1}</b>:\n<blockquote>${
          linkifyText(clues[i].clue)
        }</blockquote>`
    }

  const relevantAddings = Array.isArray(timeAddings)
    ? timeAddings.filter((adding) => isTimeAddingForTask(adding, taskNum, taskEntry) || (!adding.taskId && adding.taskIndex === undefined))
    : []

  const addingsSummary =
    relevantAddings.length > 0
      ? `\n\n<b>Бонусы и штрафы текущего задания:</b>\n${relevantAddings
          .map((adding) => {
            const { name, time } = adding
            const isBonus = time < 0
            const timeText = secondsToTimeStr(Math.abs(getTimeAddingSeconds(adding)), true) || '0 сек.'
            const icon = isBonus ? '\u{1F7E2}' : '\u{1F534}'
            return `${icon} ${timeText} - ${name}`
          })
          .join('\n')}`
      : ''

  const showTimedCountdown =
    clueTimes.length > 0 && effectiveVisibleClues < totalCluesCount

  const nextClueIndex = effectiveVisibleClues + 1
  const secondsToNextClue = showTimedCountdown
    ? Math.max(clueTimes[nextClueIndex - 1] - taskSecondsLeft, 0)
    : 0
  const secondsToTaskFinish = Math.max(taskDuration - taskSecondsLeft, 0)

  const countdownLabel = showTimedCountdown
    ? 'Время до подсказки'
    : 'Время до завершения задания'

  const countdownSeconds = showTimedCountdown
    ? secondsToNextClue
    : secondsToTaskFinish

  const targetTimestamp = (() => {
    if (!startTaskDate) return null
    const base = startTaskDate.getTime()
    if (showTimedCountdown) {
      return base + (clueTimes[nextClueIndex - 1] - clueAdvanceSeconds + freezeRemaining) * 1000
    }
    return base + (taskDuration - clueAdvanceSeconds + freezeRemaining) * 1000
  })()

  const countdownValue = (() => {
    if (format === 'web') {
      if (!showTimedCountdown && taskDuration <= 0) return ''
      const attributes = [
        `data-task-countdown="${showTimedCountdown ? 'hint' : 'task'}"`,
        'data-refresh-on-complete="true"',
      ]
      if (Number.isFinite(targetTimestamp)) {
        attributes.push(`data-target="${targetTimestamp}"`)
      }
      if (Number.isFinite(countdownSeconds)) {
        attributes.push(`data-seconds="${countdownSeconds}"`)
      }

      return `<span ${attributes.join(' ')}${pauseAttribute}>${secondsToTime(
        countdownSeconds
      )}</span>`
    }

    return secondsToTime(countdownSeconds)
  })()

  const actionPrompt = `<b>${
    game.type === 'photo' ? 'ОТПРАВТЕ ФОТО' : 'ВВЕДИТЕ КОД'
  }</b>`

  const taskBodyHtml = getTaskBodyHtml({
    taskTextValue: task,
    taskRichValue: taskRich,
    format,
  })

  const taskFinishCountdown =
    format === 'web' && showTimedCountdown && taskDuration > 0
      ? `<span data-task-countdown="task" data-refresh-on-complete="true"${pauseAttribute}${startTaskDate ? ` data-target="${startTaskDate.getTime() + (taskDuration - clueAdvanceSeconds + freezeRemaining) * 1000}"` : ''} data-seconds="${secondsToTaskFinish}">${secondsToTime(secondsToTaskFinish)}</span>`
      : ''
  const freezeCountdown = freezeRemaining > 0 ? `<span data-task-countdown="freeze" data-refresh-on-complete="true" data-seconds="${freezeRemaining}">${secondsToTime(freezeRemaining)}</span>` : ''
  const webHiddenCountdown = `<span style="display:none" aria-hidden="true">${countdownValue}${taskFinishCountdown}${freezeCountdown}</span>`

  return `<b>Задание №${taskNum + 1}${
    taskEntry.isBonusTask ? ' (БОНУСНОЕ)' : ''
  }:</b>\n${taskBodyHtml}${cluesText}${
    game.type !== 'photo' && (haveBonusCodes || havePenaltyCodes)
      ? `\n\n<b>Внимание:</b> На месте есть ${
          haveBonusCodes && havePenaltyCodes
            ? `бонусные (${bonusCodes.length} шт.) и штрафные (${penaltyCodes.length} шт.)`
            : haveBonusCodes
            ? `бонусные (${bonusCodes.length} шт.)`
            : `штрафные (${penaltyCodes.length} шт.)`
        } коды!${
          haveBonusCodes
            ? ' Бонусные коды сработают, только если ввести его до завершения задания (ввода основных кодов)'
            : ''
        }`
      : ''
  }${
    game.type === 'photo'
      ? `\n\n<b>За выполнение основного задания</b>: ${getNounPoints(
          taskBonusForComplite || 0
        )}\n\n<b>Доп. задания</b>:${
          !subTasks?.length
            ? ' отсутствуют'
            : `\n${
                subTasks.length > 0
                  ? subTasks
                      .map(
                        ({ name, task: subTaskText, bonus }) =>
                          `"${name}" - ${getNounPoints(
                            bonus
                          )}\n<blockquote>${linkifyText(
                            subTaskText
                          )}</blockquote>`
                      )
                      .join('')
                  : ''
              }`
        }`
      : `\n\n<b>Количество кодов на локации:</b> ${codes?.length ?? 0}${
          numCodesToCompliteTask
            ? `\n<b>Количество кодов необходимое для выполнения задания:</b> ${numCodesToCompliteTask}`
            : ''
        }`
  }${
    game.type !== 'photo' &&
    findedBonusCodes &&
    findedBonusCodes[taskNum]?.length > 0
      ? `\n\n<b>Найденные бонусные коды:</b>\n${bonusCodes
          .filter(({ code }) => findedBonusCodes[taskNum].includes(code))
          .map(
            ({ code, bonus, description }) =>
              `"${code}" - ${secondsToTimeStr(bonus)} - ${description}`
          )
          .join('\n')}`
      : ''
  }${
    game.type !== 'photo' &&
    findedPenaltyCodes &&
    findedPenaltyCodes[taskNum]?.length > 0
      ? `\n\n<b>Найденные штрафные коды:</b>\n${penaltyCodes
          .filter(({ code }) => findedPenaltyCodes[taskNum].includes(code))
          .map(
            ({ code, penalty, description }) =>
              `"${code}" - ${secondsToTimeStr(penalty)} - ${description}`
          )
          .join('\n')}`
      : ''
  }${
    game.type !== 'photo' && (findedCodesInTask.length > 0 || virtualCodesCount > 0)
      ? `${findedCodesInTask.length > 0 ? `\n\n<b>Найденные коды:</b>\n"${findedCodesInTask.join('", "')}"` : ''}${virtualCodesCount > 0 ? `\n\n<b>Закрыто отмычкой:</b> ${virtualCodesCount}` : ''}\n\nОсталось найти ${getNounCodes(numOfCodesToFindLeft)}`
      : ''
  }${
    game.type === 'photo' && photos && photos[taskNum]?.photos?.length > 0
      ? `\n\n<b>Получено фото-ответов</b>: ${photos[taskNum]?.photos.length} шт.`
      : ''
  }${addingsSummary}${
    format === 'web'
      ? `\n\n${webHiddenCountdown}`
      : `\n\n<b>${countdownLabel}</b>: ${countdownValue}`
  }${
    includeActionPrompt ? `\n\n${actionPrompt}` : ''
  }`
}

export default taskText
