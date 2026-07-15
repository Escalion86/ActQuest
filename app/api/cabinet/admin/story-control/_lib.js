import { NextResponse } from 'next/server'

import {
  changeStoryScore,
  completeStoryNode,
  consumeStoryItem,
  grantStoryItem,
  reachStoryEnding,
  unlockStoryNode,
} from '@server/storyEngine'
import {
  buildAdminStoryTeamPayload,
  jsonError,
  loadAdminStoryContext,
  normalizeStringId,
  readJsonPayload,
  runLockedStoryMutation,
} from '@app/api/cabinet/_lib/storyApi'
import { notifyAgentsForGameTeamProgress } from '@server/agentNotifications'
import {
  adjustInvestigationTime,
  grantInvestigationEvidence,
  setInvestigationLocation,
  unlockInvestigationCharacter,
  unlockInvestigationTopic,
} from '@server/storyInvestigationEngine'

export const runAdminStoryMutation = async ({ request, action }) => {
  const payload = await readJsonPayload(request)
  const context = await loadAdminStoryContext({
    request,
    requireTeam: true,
    gameIdOverride: payload?.gameId,
    teamIdOverride: payload?.teamId ?? payload?.gameTeamId,
  })
  if (context.response) {
    return context.response
  }
  if (context.game?.status !== 'started') {
    return jsonError('Story-действия доступны только во время запущенной игры', 409)
  }

  const lockedMutation = await runLockedStoryMutation({
    context,
    actor: 'admin',
    action: ({ progress, ...lockedContext }) =>
      action({ ...lockedContext, payload, progress }),
  })
  if (lockedMutation.response) return lockedMutation.response

  const mutationResult = lockedMutation.mutationResult
  const nextProgress = lockedMutation.progress
  await notifyAgentsForGameTeamProgress({
    db: context.db,
    game: context.game,
    gameTeam: {
      ...lockedMutation.gameTeam,
      storyProgress: nextProgress,
    },
    team: context.team,
  })

  return NextResponse.json({
    success: true,
    data: {
      applied: Boolean(mutationResult?.applied),
      reason: mutationResult?.reason || null,
      team: buildAdminStoryTeamPayload({
        game: context.game,
        team: context.team,
        gameTeam: lockedMutation.gameTeam,
        progress: nextProgress,
      }),
    },
  })
}

export const adminGrantItemAction = ({ game, progress, payload }) =>
  grantStoryItem({
    game,
    progress,
    itemId: payload?.itemId,
    actor: 'admin',
    nodeId: payload?.nodeId,
  })

export const adminConsumeItemAction = ({ game, progress, payload }) =>
  consumeStoryItem({
    game,
    progress,
    itemId: payload?.itemId,
    actor: 'admin',
    nodeId: payload?.nodeId,
    actionId: payload?.actionId,
  })

export const adminUnlockNodeAction = ({ game, progress, payload }) =>
  unlockStoryNode({
    game,
    progress,
    nodeId: payload?.nodeId,
    actor: 'admin',
  })

export const adminCompleteNodeAction = ({ game, progress, payload }) =>
  completeStoryNode({
    game,
    progress,
    nodeId: payload?.nodeId,
    actor: 'admin',
  })

export const adminAdjustScoreAction = ({ progress, payload }) => {
  const points = Number(payload?.points)
  if (!Number.isFinite(points) || Math.round(points) === 0) {
    return { progress, applied: false, reason: 'invalid_points' }
  }

  return changeStoryScore({
    progress,
    points: Math.round(points),
    reason: normalizeStringId(payload?.reason) || 'admin_score_adjustment',
    actor: 'admin',
    nodeId: payload?.nodeId,
  })
}

export const adminFinishAction = ({ game, progress, payload }) =>
  reachStoryEnding({
    game,
    progress,
    endingId: payload?.endingId,
    actor: 'admin',
    nodeId: payload?.nodeId,
  })

export const adminSetInvestigationLocationAction = ({
  game,
  progress,
  payload,
}) =>
  setInvestigationLocation({
    game,
    progress,
    nodeId: payload?.nodeId,
    actor: 'admin',
  })

export const adminAdjustInvestigationTimeAction = ({
  game,
  progress,
  payload,
}) =>
  adjustInvestigationTime({
    game,
    progress,
    minutes: payload?.minutes,
    actor: 'admin',
  })

export const adminUnlockInvestigationCharacterAction = ({
  game,
  progress,
  payload,
}) =>
  unlockInvestigationCharacter({
    game,
    progress,
    characterId: payload?.characterId,
    actor: 'admin',
  })

export const adminUnlockInvestigationTopicAction = ({
  game,
  progress,
  payload,
}) =>
  unlockInvestigationTopic({
    game,
    progress,
    topicId: payload?.topicId,
    actor: 'admin',
  })

export const adminGrantInvestigationEvidenceAction = ({
  game,
  progress,
  payload,
}) =>
  grantInvestigationEvidence({
    game,
    progress,
    evidenceId: payload?.evidenceId,
    actor: 'admin',
  })
