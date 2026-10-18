// Индексы здесь относятся к заданиям редактора, а не к шагам маршрута команды.
export default function buildGameTaskOverview({ tasks = [], teams = [], taskDuration = 0 }) {
  const overview = tasks.map((task, taskIndex) => ({
    taskIndex,
    title: task?.title || task?.publicTitle || 'Без названия',
    canceled: Boolean(task?.canceled),
    counts: { pending: 0, active: 0, completed: 0, failed: 0, excluded: 0 },
    teams: [],
  }))

  for (const team of teams) {
    const statsByIndex = new Map(
      (team.teamProgressStats?.tasks || []).map((task) => [task.taskIndex, task]),
    )
    const route = new Set(team.taskSequence || tasks.map((_, index) => index))
    for (const item of overview) {
      if (item.canceled) continue
      const stats = statsByIndex.get(item.taskIndex)
      const isCurrent = team.activeTaskIndex === item.taskIndex
      let state = 'pending'
      if (stats?.endedAt) state = 'completed'
      else if (stats?.isFailedTask) state = 'failed'
      else if (!route.has(item.taskIndex)) state = 'excluded'
      else if (isCurrent && !team.isTeamFinished && (stats?.startedAt || team.isChoosingVariant)) state = 'active'

      const remainingSeconds = state === 'active' && taskDuration > 0 && stats?.startedAt
        ? Math.max(0, taskDuration - (Number(team.currentTaskSeconds) || 0))
        : null
      const failureReason = state !== 'failed' ? null
        : stats.failedByCaptain ? 'Слив капитаном'
          : stats.failureSource === 'admin' ? 'Пропущено администратором'
          : stats.failureSource === 'system' ? 'Пропущено системой'
          : stats.failedByTimeout || (taskDuration > 0 && stats.completedSeconds >= taskDuration)
            ? 'Время вышло' : 'Задание не завершено'

      item.counts[state] += 1
      item.teams.push({
        teamId: team.teamId,
        teamName: team.teamName,
        state,
        failureReason,
        remainingSeconds,
        foundCodesCount: stats?.mainCodes?.length || 0,
        requiredCodesCount: stats?.requiredCodesCount ?? null,
        variantTitle: stats?.variantTitle || '',
        isChoosingVariant: state === 'active' && Boolean(team.isChoosingVariant),
      })
    }
  }
  return overview
}
