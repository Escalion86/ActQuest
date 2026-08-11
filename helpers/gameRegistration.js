const normalizeStatus = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export const isIndividualGameStart = (game) =>
  game?.type === 'story'
    ? game?.storyConfig?.startMode === 'individual'
    : Boolean(game?.individualStart)

export const canJoinGameAfterStart = (game) =>
  Boolean(game?.allowJoinAfterStart) && isIndividualGameStart(game)

export const getGameRegistrationError = (game) => {
  if (game?.registrationOpen === false) {
    return 'Запись на эту игру закрыта'
  }

  const status = normalizeStatus(game?.status)
  if (status === 'active') {
    return null
  }

  if (status === 'started' && canJoinGameAfterStart(game)) {
    return null
  }

  return 'Запись на эту игру закрыта'
}

export const canRegisterForGame = (game) => !getGameRegistrationError(game)

