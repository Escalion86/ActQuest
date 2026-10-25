export const getControlTaskTitle = (data, taskIndex, title) => {
  const publicTitle = data?.useCustomTaskPublicTitles
    ? data.tasks?.[taskIndex]?.publicTitle?.trim()
    : ''
  return publicTitle || title?.trim() || 'Без названия'
}

// Прогресс сравнивается по шагу маршрута команды, а не индексу задания.
export const compareGameControlTeams = (a, b) => {
  if (b.activeTaskStep !== a.activeTaskStep) {
    return b.activeTaskStep - a.activeTaskStep
  }
  if (a.isTeamFinished || b.isTeamFinished) {
    if (a.isTeamFinished && !b.isTeamFinished) return -1
    if (!a.isTeamFinished && b.isTeamFinished) return 1
    return a.sumTimeSeconds - b.sumTimeSeconds
  }
  if (a.isTeamOnBreak || b.isTeamOnBreak) {
    if (a.isTeamOnBreak && !b.isTeamOnBreak) return -1
    if (!a.isTeamOnBreak && b.isTeamOnBreak) return 1
    if (a.breakTimeLeftSeconds !== b.breakTimeLeftSeconds) {
      return a.breakTimeLeftSeconds - b.breakTimeLeftSeconds
    }
  } else if (a.currentTaskSeconds !== b.currentTaskSeconds) {
    return b.currentTaskSeconds - a.currentTaskSeconds
  }
  return b.findedCodesCount - a.findedCodesCount
}
