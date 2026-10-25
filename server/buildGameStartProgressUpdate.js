import createTaskProgressArrays from '../helpers/createTaskProgressArrays.js'
import removeCluePenalties from '../helpers/removeCluePenalties.js'
import { isValidTaskSequence } from '../helpers/taskDistribution.js'

const buildGameStartProgressUpdate = ({
  gameTasksCount,
  startImmediately,
  timeAddings = [],
  storyProgress = null,
  taskSequence = [],
  startedAt = new Date(),
}) => {
  const startTime = startImmediately
    ? new Array(gameTasksCount).fill(null)
    : []
  if (startImmediately && gameTasksCount > 0) {
    const firstTaskIndex = isValidTaskSequence(taskSequence, gameTasksCount)
      ? taskSequence[0]
      : 0
    startTime[firstTaskIndex] = new Date(startedAt)
  }

  const endTime = startImmediately
    ? new Array(gameTasksCount).fill(null)
    : []
  const {
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    photos,
  } = createTaskProgressArrays(gameTasksCount)

  return {
    startTime,
    endTime,
    activeNum: 0,
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    codeAttempts: [],
    photos,
    taskFailures: [],
    timeAddings: removeCluePenalties(timeAddings),
    forcedClues: startImmediately ? new Array(gameTasksCount).fill(0) : [],
    storyProgress,
    classicProgress: null,
  }
}

export default buildGameStartProgressUpdate
