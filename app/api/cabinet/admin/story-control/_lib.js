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
  ensureStoryProgress,
  loadAdminStoryContext,
  normalizeStringId,
  readJsonPayload,
} from '@app/api/cabinet/_lib/storyApi'
import { notifyAgentsForGameTeamProgress } from '@server/agentNotifications'

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

  const progress = await ensureStoryProgress({
    GamesTeams: context.GamesTeams,
    game: context.game,
    gameTeam: context.gameTeam,
    actor: 'admin',
    save: true,
  })

  const mutationResult = action({ ...context, payload, progress })
  const nextProgress = mutationResult?.progress || progress

  await context.GamesTeams.updateOne(
    { _id: context.gameTeam._id },
    { $set: { storyProgress: nextProgress } },
  )
  await notifyAgentsForGameTeamProgress({
    db: context.db,
    game: context.game,
    gameTeam: {
      ...(context.gameTeam.toObject?.() || context.gameTeam),
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
        gameTeam: context.gameTeam,
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
