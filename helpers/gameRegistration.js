const normalizeStatus = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export const isIndividualGameStart = (game) =>
  game?.type === 'story'
    ? game?.storyConfig?.startMode === 'individual'
    : Boolean(game?.individualStart)

export const canJoinGameAfterStart = (game) =>
  Boolean(game?.allowJoinAfterStart) && isIndividualGameStart(game)

export const normalizeMaxTeams = (value) => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Лимит команд должен быть положительным целым числом')
  }
  return value
}

export const getGameRegistrationError = (game, { manual = false, teamsCount } = {}) => {
  const status = normalizeStatus(game?.status)
  // Ручное добавление администратором — исключение только для командных игр.
  if (manual && game?.participationMode !== 'player') {
    return ['active', 'started'].includes(status) ? null : 'Запись на эту игру закрыта'
  }
  if (game?.registrationOpen === false) {
    return 'Запись на эту игру закрыта'
  }

  // Лимит проверяется только когда вызывающий передал количество команд явно:
  // на проде уже есть игры с сохранённым maxTeams, и молчаливое изменение
  // поведения старых путей регистрации недопустимо.
  if (game?.participationMode !== 'player' && Number.isSafeInteger(game?.maxTeams) && game.maxTeams > 0 &&
      teamsCount !== undefined && teamsCount !== null && Number(teamsCount) >= game.maxTeams) {
    return 'Достигнут лимит команд на эту игру'
  }
  if (status === 'active') {
    return null
  }

  if (status === 'started' && canJoinGameAfterStart(game)) {
    return null
  }

  return 'Запись на эту игру закрыта'
}

export const canRegisterForGame = (game) => !getGameRegistrationError(game)

