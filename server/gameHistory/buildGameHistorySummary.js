const ACTION_TYPE_SUMMARY = {
  game_created: 'Создание игры',
  game_updated: 'Изменение игры',
  game_status_changed: 'Изменение статуса игры',
  team_registered: 'Регистрация команды на игру',
  team_unregistered: 'Отмена регистрации команды',
  team_adjustments_updated: 'Изменение корректировок команды',
  team_out_of_competition_changed: 'Изменение статуса вне зачёта',
  results_rebuilt: 'Обновление результатов игры',
  rollback_applied: 'Откат состояния игры',
}

const buildGameHistorySummary = ({ actionType = '', context = {} } = {}) => {
  if (typeof context?.summary === 'string' && context.summary.trim()) {
    return context.summary.trim()
  }

  return ACTION_TYPE_SUMMARY[actionType] || 'Изменение игры'
}

export default buildGameHistorySummary
