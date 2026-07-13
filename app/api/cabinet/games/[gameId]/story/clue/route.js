import { NextResponse } from 'next/server'

import { useStoryClue } from '@server/storyEngine'
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
    const clueId = normalizeStringId(payload?.clueId)

    if (!nodeId || !clueId) {
      return NextResponse.json(
        { success: false, error: 'Не указан nodeId или clueId' },
        { status: 400 },
      )
    }

    const lockedMutation = await runLockedStoryMutation({
      context,
      actor: 'team',
      action: ({ game, progress }) =>
        useStoryClue({
          game,
          progress,
          nodeId,
          clueId,
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
        clue: result.clue
          ? {
              id: result.clue.id,
              title: result.clue.title,
              contentRich: result.clue.contentRich,
              media: Array.isArray(result.clue.media) ? result.clue.media : [],
              scorePenalty: Number(result.clue.scorePenalty) || 0,
            }
          : null,
        state: buildTeamStoryStatePayload(nextContext),
      },
    })
  } catch (error) {
    console.error('Failed to use story clue', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось открыть подсказку' },
      { status: 500 },
    )
  }
}
