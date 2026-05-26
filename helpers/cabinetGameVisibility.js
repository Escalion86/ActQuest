import {
  buildDefaultPrequel,
  normalizePrequelConfig,
} from '@helpers/normalizePrequel'
import { canBypassGameAssignments } from '@helpers/gameAssignmentAccess'

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

const sanitizeCabinetGameForViewer = (game, { canViewRestrictedGameInfo }) => {
  if (!game || typeof game !== 'object' || canViewRestrictedGameInfo) {
    return game
  }

  return {
    ...game,
    clueEarlyAccessMode: undefined,
    clueEarlyPenalty: undefined,
    manyCodesPenalty: undefined,
    individualStart: false,
    showCreator: false,
    showTasks: false,
    hideResult: Boolean(game?.hideResult),
    finances: [],
    tasks: [],
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
  canViewCabinetGameRestrictedInfo,
  sanitizeCabinetGameForViewer,
}
