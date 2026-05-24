import createTaskProgressArrays from '../helpers/createTaskProgressArrays.js'
import removeCluePenalties from '../helpers/removeCluePenalties.js'

const buildGameStartProgressUpdate = ({
  gameTasksCount,
  startImmediately,
  timeAddings = [],
}) => {
  const startTime = startImmediately
    ? new Array(gameTasksCount).fill(null)
    : []
  if (startImmediately && gameTasksCount > 0) {
    startTime[0] = new Date()
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
    storyProgress: null,
  }
}

export default buildGameStartProgressUpdate
