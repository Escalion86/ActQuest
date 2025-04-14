const isGameHaveErrors = (game) =>
  game?.tasks
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
              ).length)
      )
    : true

export default isGameHaveErrors
