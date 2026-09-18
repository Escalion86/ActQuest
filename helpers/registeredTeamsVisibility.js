const REGISTERED_TEAMS_VISIBILITY = {
  LIST: 'list',
  COUNT: 'count',
  HIDDEN: 'hidden',
}

const normalizeRegisteredTeamsVisibility = (value) => {
  if (value === REGISTERED_TEAMS_VISIBILITY.COUNT) {
    return REGISTERED_TEAMS_VISIBILITY.COUNT
  }

  if (value === REGISTERED_TEAMS_VISIBILITY.HIDDEN) {
    return REGISTERED_TEAMS_VISIBILITY.HIDDEN
  }

  return REGISTERED_TEAMS_VISIBILITY.LIST
}

export { REGISTERED_TEAMS_VISIBILITY, normalizeRegisteredTeamsVisibility }

