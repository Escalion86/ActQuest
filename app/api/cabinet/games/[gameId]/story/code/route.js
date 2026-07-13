import { NextResponse } from 'next/server'

import { applyStoryCode } from '@server/storyEngine'
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
    })
    if (context.response) {
      return context.response
    }

    const nodeId = normalizeStringId(payload?.nodeId)
    const code = typeof payload?.code === 'string' ? payload.code.trim() : ''

    if (!nodeId || !code) {
      return NextResponse.json(
        { success: false, error: 'Не указан nodeId или code' },
        { status: 400 },
      )
    }

    const lockedMutation = await runLockedStoryMutation({
      context,
      actor: 'team',
      action: ({ game, progress }) =>
        applyStoryCode({
          game,
          progress,
          nodeId,
          code,
          actor: 'team',
        }),
    })
    if (lockedMutation.response) return lockedMutation.response

    const result = lockedMutation.mutationResult
    await notifyAgentsForGameTeamProgress({
      db: context.db,
      game: context.game,
      gameTeam: {
        ...lockedMutation.gameTeam,
        storyProgress: lockedMutation.progress,
      },
      team: context.team,
    })

    const nextContext = {
      ...context,
      gameTeam: lockedMutation.gameTeam,
      progress: lockedMutation.progress,
    }
    return NextResponse.json({
      success: true,
      data: {
        applied: Boolean(result.applied),
        reason: result.reason || null,
        state: buildTeamStoryStatePayload(nextContext),
      },
    })
  } catch (error) {
    console.error('Failed to apply story code', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось применить код' },
      { status: 500 },
    )
  }
}
