const CLOSED_GAME_EDITABLE_KEYS = [
  'showCreator',
  'showFinishingPlace',
  'showTasks',
  'showTasksAudience',
  'showTasksCountInGame',
  'hideResult',
  'registrationOpen',
]

const isClosedStatus = (status) =>
  (typeof status === 'string' ? status.toLowerCase() : String(status)) ===
  'closed'

export const areGameDraftsEqual = (left, right) =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

export const applyGameDraftPatch = ({ prevGame, baselineGame, patch }) => {
  if (!prevGame) {
    return {
      nextGame: prevGame,
      hasUnsavedChanges: false,
    }
  }

  const patchObject = patch && typeof patch === 'object' ? patch : {}
  const normalizedPatch = isClosedStatus(prevGame.status)
    ? Object.fromEntries(
        Object.entries(patchObject).filter(([key]) =>
          CLOSED_GAME_EDITABLE_KEYS.includes(key),
        ),
      )
    : patchObject

  if (Object.keys(normalizedPatch).length === 0) {
    return {
      nextGame: prevGame,
      hasUnsavedChanges: baselineGame
        ? !areGameDraftsEqual(prevGame, baselineGame)
        : false,
    }
  }

  const nextGame = { ...prevGame, ...normalizedPatch }
  if (Boolean(nextGame.isRated ?? true)) {
    nextGame.hidden = false
  } else {
    nextGame.seasonId = ''
    nextGame.seasonName = ''
  }

  return {
    nextGame,
    hasUnsavedChanges: baselineGame
      ? !areGameDraftsEqual(nextGame, baselineGame)
      : !areGameDraftsEqual(nextGame, prevGame),
  }
}
