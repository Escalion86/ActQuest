export const getGameValidationErrors = (game) => {
  const errors = []
  const safeGame = game && typeof game === 'object' ? game : {}
  const taskDuration = Number(safeGame.taskDuration ?? 3600) || 3600
  const cluesDuration = Number(safeGame.cluesDuration ?? 1200) || 0
  const cluesNeeded =
    cluesDuration > 0 ? Math.ceil((taskDuration - cluesDuration) / cluesDuration) : 0
  const activeTasks = Array.isArray(safeGame.tasks)
    ? safeGame.tasks.filter((task) => !task?.canceled)
    : []

  if (taskDuration - cluesDuration < 0) {
    errors.push('Время до подсказки больше, чем длительность задания.')
  }

  if (!safeGame.startingPlace) {
    errors.push('Не указано время и место сбора.')
  }

  if (!safeGame.finishingPlace) {
    errors.push('Не указано место сбора после игры.')
  }

  if (activeTasks.length === 0) {
    errors.push('Добавьте хотя бы одно активное задание.')
    return errors
  }

  activeTasks.forEach((task, index) => {
    const taskLabel = `Задание ${index + 1}`

    if (!task?.title) {
      errors.push(`${taskLabel}: не указано название.`)
    }

    if (!task?.task) {
      errors.push(`${taskLabel}: не заполнено описание задания.`)
    }

    if (safeGame.type !== 'photo') {
      const taskCodes = Array.isArray(task?.codes)
        ? task.codes.filter((code) => typeof code === 'string' && code.trim() !== '')
        : []
      const taskCodesLength = taskCodes.length
      const neededCodesLength = Number(task?.numCodesToCompliteTask || 0)

      if (!taskCodesLength) {
        errors.push(`${taskLabel}: не добавлен ни один код.`)
      }

      if (taskCodesLength < neededCodesLength) {
        errors.push(
          `${taskLabel}: кодов меньше, чем требуется для выполнения (${taskCodesLength}/${neededCodesLength}).`
        )
      }
    }

    if (cluesDuration > 0) {
      const cluesCount = Array.isArray(task?.clues) ? task.clues.length : 0
      if (cluesCount < cluesNeeded) {
        errors.push(
          `${taskLabel}: недостаточно подсказок (${cluesCount}/${cluesNeeded}).`
        )
      }
    }
  })

  return errors
}

const isGameHaveErrors = (game) => getGameValidationErrors(game).length > 0

export default isGameHaveErrors
