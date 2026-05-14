import { NextResponse } from 'next/server'

import { applyStoryAction } from '@server/storyEngine'
import { notifyAgentsForGameTeamProgress } from '@server/agentNotifications'
import {
  buildTeamStoryStatePayload,
  loadPlayerStoryContext,
  normalizeStringId,
  readJsonPayload,
} from '@app/api/cabinet/_lib/storyApi'

export async function POST(request, { params }) {
  try {
    const payload = await readJsonPayload(request)
    const context = await loadPlayerStoryContext({
      request,
      params,
      teamIdOverride: payload?.teamId,
    })
    if (context.response) {
      return context.response
    }

    const nodeId = normalizeStringId(payload?.nodeId)
    const actionId = normalizeStringId(payload?.actionId)

    if (!nodeId || !actionId) {
      return NextResponse.json(
        { success: false, error: 'Не указан nodeId или actionId' },
        { status: 400 },
      )
    }

    const result = applyStoryAction({
      game: context.game,
      progress: context.progress,
      nodeId,
      actionId,
      actor: 'team',
    })

    await context.GamesTeams.updateOne(
      { _id: context.gameTeam._id },
      { $set: { storyProgress: result.progress } },
    )
    await notifyAgentsForGameTeamProgress({
      db: context.db,
      game: context.game,
      gameTeam: {
        ...(context.gameTeam.toObject?.() || context.gameTeam),
        storyProgress: result.progress,
      },
      team: context.team,
    })

    const nextContext = { ...context, progress: result.progress }
    return NextResponse.json({
      success: true,
      data: {
        applied: Boolean(result.applied),
        reason: result.reason || null,
        state: buildTeamStoryStatePayload(nextContext),
      },
    })
  } catch (error) {
    console.error('Failed to apply story action', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось выполнить действие' },
      { status: 500 },
    )
  }
}
