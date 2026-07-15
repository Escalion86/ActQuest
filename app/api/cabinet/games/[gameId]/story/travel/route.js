import { NextResponse } from 'next/server'

import { travelInvestigation } from '@server/storyInvestigationEngine'
import { notifyAgentsForGameTeamProgress } from '@server/agentNotifications'
import {
  buildTeamStoryStatePayload,
  loadPlayerStoryContext,
  normalizeStringId,
  readJsonPayload,
  runLockedStoryMutation,
} from '@app/api/cabinet/_lib/storyApi'

export async function POST(request, { params }) {
  try {
    const payload = await readJsonPayload(request)
    const context = await loadPlayerStoryContext({
      request,
      params,
      teamIdOverride: payload?.teamId,
      requireStarted: true,
    })
    if (context.response) return context.response

    const targetNodeId = normalizeStringId(payload?.targetNodeId)
    if (!targetNodeId) {
      return NextResponse.json(
        { success: false, error: 'Не указан targetNodeId' },
        { status: 400 },
      )
    }

    const lockedMutation = await runLockedStoryMutation({
      context,
      actor: 'team',
      action: ({ game, progress }) =>
        travelInvestigation({ game, progress, targetNodeId, actor: 'team' }),
    })
    if (lockedMutation.response) return lockedMutation.response

    const result = lockedMutation.mutationResult
    if (result?.applied || result?.reason === 'deadline_exceeded') {
      await notifyAgentsForGameTeamProgress({
        db: context.db,
        game: context.game,
        gameTeam: {
          ...lockedMutation.gameTeam,
          storyProgress: lockedMutation.progress,
        },
        team: context.team,
      })
    }
    const nextContext = {
      ...context,
      gameTeam: lockedMutation.gameTeam,
      progress: lockedMutation.progress,
    }
    return NextResponse.json({
      success: true,
      data: {
        applied: Boolean(result?.applied),
        reason: result?.reason || null,
        state: buildTeamStoryStatePayload(nextContext),
      },
    })
  } catch (error) {
    console.error('Failed to travel in story investigation', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось перейти в локацию' },
      { status: 500 },
    )
  }
}
