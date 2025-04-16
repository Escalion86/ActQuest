const isGameHaveErrors = (game) => {
  const taskDuration = game.taskDuration ?? 3600
  const cluesDuration = game.cluesDuration ?? 1200
  const cluesNeeded = Math.ceil((taskDuration - cluesDuration) / cluesDuration)

  if (taskDuration - cluesDuration < 0) return true

  return game?.tasks && game?.startingPlace && game?.finishingPlace
    ? !!game.tasks.find(
        (task) =>
          !task.canceled &&
          (game.type === 'photo'
            ? !task.title || !task.task
            : !task.title ||
              !task.task ||
              !(
                typeof task?.codes === 'object' && task.codes !== null
                  ? task.codes.filter((code) => code !== '')
                  : []
              ).length ||
              (cluesDuration > 0
                ? (task.clues?.length || 0) < cluesNeeded
                : false))
      )
    : true
}

export default isGameHaveErrors
