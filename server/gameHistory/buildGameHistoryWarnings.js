const RESULT_RELATED_ACTIONS = new Set([
  'game_status_changed',
  'team_registered',
  'team_unregistered',
  'team_adjustments_updated',
  'team_out_of_competition_changed',
  'results_rebuilt',
  'rollback_applied',
])

const buildGameHistoryWarnings = ({
  actionType = '',
  gameStatus = '',
  context = {},
} = {}) => {
  const warnings = new Set(
    Array.isArray(context?.warnings) ? context.warnings.filter(Boolean) : [],
  )

  if (String(gameStatus).trim().toLowerCase() === 'started') {
    warnings.add(
      'Игра запущена. Откат или повторное изменение может затронуть живой прогресс команд.',
    )
  }

  if (RESULT_RELATED_ACTIONS.has(actionType)) {
    warnings.add(
      'Изменение может повлиять на результаты игры и привести к расхождению рейтингов или закрытой статистики.',
    )
  }

  return Array.from(warnings)
}

export default buildGameHistoryWarnings
