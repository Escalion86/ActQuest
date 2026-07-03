export const countActiveGameTasks = (tasks = []) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { main: 0, bonus: 0 }
  }

  return tasks.reduce(
    (acc, task) => {
      if (task?.canceled) {
        return acc
      }

      if (task?.isBonusTask) {
        acc.bonus += 1
      } else {
        acc.main += 1
      }

      return acc
    },
    { main: 0, bonus: 0 },
  )
}

export const buildGameTasksStats = (tasks = []) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { total: 0, bonus: 0, canceled: 0 }
  }

  return tasks.reduce(
    (acc, task) => {
      if (task?.canceled) {
        acc.canceled += 1
        return acc
      }

      if (task?.isBonusTask) {
        acc.bonus += 1
      } else {
        acc.total += 1
      }

      return acc
    },
    { total: 0, bonus: 0, canceled: 0 },
  )
}

export const getVisibleGameTaskCounts = (game) => {
  if (!game?.showTasksCountInGame) {
    return null
  }

  if (game?.tasksStats && typeof game.tasksStats === 'object') {
    return {
      main: Math.max(0, Number(game.tasksStats.total) || 0),
      bonus: Math.max(0, Number(game.tasksStats.bonus) || 0),
    }
  }

  return countActiveGameTasks(game.tasks)
}

export const buildGameTaskCountLabel = (counts) => {
  if (!counts) {
    return ''
  }

  const main = Math.max(0, Number(counts.main) || 0)
  const bonus = Math.max(0, Number(counts.bonus) || 0)

  return bonus > 0 ? `${main} + ${bonus} бонусных` : `${main}`
}
