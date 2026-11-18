import {
  buildDefaultPrequel,
  getGamePrequels,
  normalizePrequelConfig,
} from './normalizePrequel.js'
import { canBypassGameAssignments } from './gameAssignmentAccess.js'

const normalizeShowTasksAudience = (value) =>
  value === 'participants' ? 'participants' : 'all'

const normalizeShowResultAudience = (value) =>
  value === 'participants' ? 'participants' : 'all'

const canReleaseGameStageContent = (
  game,
  { releaseStageContent = game?.stageResultPublished } = {},
) => !game?.stageId || releaseStageContent === true

const canViewPublishedGameResults = (
  game,
  options = {},
) => Boolean(
  options.canViewRestrictedGameInfo ||
    (canReleaseGameStageContent(game, options) &&
      !game?.hideResult &&
      (normalizeShowResultAudience(game?.showResultAudience) === 'all' ||
        options.hasUserParticipation)),
)

const isCompletedGameStatus = (status) => {
  const normalized =
    typeof status === 'string' ? status.toLowerCase() : String(status)
  return normalized === 'finished' || normalized === 'closed'
}

const canExposePublishedGameTasks = (
  game,
  options = {},
) => {
  if (!game?.showTasks || !isCompletedGameStatus(game.status) || !canReleaseGameStageContent(game, options)) {
    return false
  }

  if (normalizeShowTasksAudience(game.showTasksAudience) === 'participants') {
    return Boolean(options.hasUserParticipation)
  }

  return true
}

const canViewPublishedGameTasks = (
  game,
  options = {},
) =>
  canExposePublishedGameTasks(game, options) &&
  Array.isArray(game?.tasks) &&
  game.tasks.length > 0

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }

  const normalized = value.trim().toLowerCase()
  return ['client', 'admin', 'dev', 'ban'].includes(normalized)
    ? normalized
    : 'client'
}

const sanitizeCreatorForPublicView = (creator) => {
  if (!creator || typeof creator !== 'object') {
    return creator
  }

  return {
    ...creator,
    phone: '',
    telegramId: '',
  }
}

const canViewCabinetGameRestrictedInfo = ({
  userRole,
  currentUserId = null,
  gameCreatorUserId = null,
  isGameModerator = false,
  allowCreatorFallback = false,
}) => {
  if (canBypassGameAssignments(userRole)) {
    return true
  }

  if (isGameModerator) {
    return true
  }

  if (currentUserId && gameCreatorUserId && currentUserId === gameCreatorUserId) {
    return true
  }

  return Boolean(allowCreatorFallback)
}

const canExposeCabinetGamePlace = (
  game,
  options = {},
) => canViewPublishedGameResults(game, options)

const sanitizeCabinetGameForViewer = (
  game,
  options,
) => {
  if (!game || typeof game !== 'object' || options.canViewRestrictedGameInfo) {
    return game
  }

  const canViewPublishedTasks = canExposePublishedGameTasks(game, options)

  return {
    ...game,
    classicItems: [],
    classicTriggers: [],
    clueEarlyAccessMode: undefined,
    clueEarlyPenalty: undefined,
    clueEarlyAccessFrom: undefined,
    manyCodesPenalty: undefined,
    individualStart: false,
    showCreator: false,
    showTasks: canViewPublishedTasks,
    showTasksAudience: normalizeShowTasksAudience(game.showTasksAudience),
    hideResult: Boolean(game?.hideResult),
    showResultAudience: normalizeShowResultAudience(game.showResultAudience),
    result: canViewPublishedGameResults(game, options)
      ? game.result
      : null,
    finances: [],
    tasks: canViewPublishedTasks && Array.isArray(game.tasks)
      ? game.tasks.map((task) => ({
          ...task,
          triggerBlocks: [],
          ...(task.variants?.length ? {
            variants: task.variants.map((variant) => ({
              ...variant,
              content: variant.content ? { ...variant.content, triggerBlocks: [] } : variant.content,
            })),
          } : {}),
        }))
      : [],
    prequel: {
      ...buildDefaultPrequel(),
      ...normalizePrequelConfig(game?.prequel, { includeCodes: false }),
    },
    prequels: getGamePrequels(game, { includeCodes: false }),
    moderators: [],
    agents: [],
    agentNotifications: undefined,
    creatorUserId: '',
    creatorTelegramId: '',
    creator: sanitizeCreatorForPublicView(game.creator),
  }
}

const canOpenRestrictedTeamGamePreview = ({
  isAdminViewer = false,
  allowRestrictedPreview = false,
}) => Boolean(isAdminViewer || allowRestrictedPreview)

const canManageCabinetGameFinances = ({
  canManageGameStatus = false,
}) => Boolean(canManageGameStatus)

export {
  canExposeCabinetGamePlace,
  canManageCabinetGameFinances,
  canOpenRestrictedTeamGamePreview,
  canReleaseGameStageContent,
  canViewPublishedGameTasks,
  canViewPublishedGameResults,
  canViewCabinetGameRestrictedInfo,
  normalizeShowTasksAudience,
  normalizeShowResultAudience,
  sanitizeCabinetGameForViewer,
}
