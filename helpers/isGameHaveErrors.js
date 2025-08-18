const isGameHaveErrors = (game) => {
  const taskDuration = game.taskDuration ?? 3600
  const cluesDuration = game.cluesDuration ?? 1200
  const cluesNeeded = Math.ceil((taskDuration - cluesDuration) / cluesDuration)

  if (taskDuration - cluesDuration < 0) return true

  return game?.tasks && game?.startingPlace && game?.finishingPlace
    ? !!game.tasks.find((task) => {
        if (task.canceled) return false

        if (game.type === 'photo') return !task.title || !task.task

        const taskCodesLength = (
          typeof task?.codes === 'object' && task.codes !== null
            ? task.codes.filter((code) => code !== '')
            : []
        ).length

        const neededCodesLength = task.numCodesToCompliteTask || 0

        return (
          !task.title ||
          !task.task ||
          !taskCodesLength ||
          (cluesDuration > 0
            ? (task.clues?.length || 0) < cluesNeeded
            : false) ||
          taskCodesLength < neededCodesLength
        )
      })
    : true
}

export default isGameHaveErrors
