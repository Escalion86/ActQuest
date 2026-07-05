import {
  buildDefaultPrequel,
  normalizePrequelConfig,
} from './normalizePrequel.js'
import { canBypassGameAssignments } from './gameAssignmentAccess.js'

const normalizeShowTasksAudience = (value) =>
  value === 'participants' ? 'participants' : 'all'

const isCompletedGameStatus = (status) => {
  const normalized =
    typeof status === 'string' ? status.toLowerCase() : String(status)
  return normalized === 'finished' || normalized === 'closed'
}

const canExposePublishedGameTasks = (
  game,
  { hasUserParticipation = false } = {},
) => {
  if (!game || !Boolean(game.showTasks) || !isCompletedGameStatus(game.status)) {
    return false
  }

  if (normalizeShowTasksAudience(game.showTasksAudience) === 'participants') {
    return Boolean(hasUserParticipation)
  }

  return true
}

const canViewPublishedGameTasks = (
  game,
  { hasUserParticipation = false } = {},
) =>
  canExposePublishedGameTasks(game, { hasUserParticipation }) &&
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

const sanitizeCabinetGameForViewer = (
  game,
  { canViewRestrictedGameInfo, hasUserParticipation = false },
) => {
  if (!game || typeof game !== 'object' || canViewRestrictedGameInfo) {
    return game
  }

  const canViewPublishedTasks = canExposePublishedGameTasks(game, {
    hasUserParticipation,
  })

  return {
    ...game,
    clueEarlyAccessMode: undefined,
    clueEarlyPenalty: undefined,
    manyCodesPenalty: undefined,
    individualStart: false,
    showCreator: false,
    showTasks: canViewPublishedTasks,
    showTasksAudience: normalizeShowTasksAudience(game.showTasksAudience),
    hideResult: Boolean(game?.hideResult),
    finances: [],
    tasks: canViewPublishedTasks && Array.isArray(game.tasks) ? game.tasks : [],
    prequel: {
      ...buildDefaultPrequel(),
      ...normalizePrequelConfig(game?.prequel, { includeCodes: false }),
    },
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
  canManageCabinetGameFinances,
  canOpenRestrictedTeamGamePreview,
  canViewPublishedGameTasks,
  canViewCabinetGameRestrictedInfo,
  normalizeShowTasksAudience,
  sanitizeCabinetGameForViewer,
}
