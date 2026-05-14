import { NextResponse } from 'next/server'

import { useStoryClue } from '@server/storyEngine'
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
    const clueId = normalizeStringId(payload?.clueId)

    if (!nodeId || !clueId) {
      return NextResponse.json(
        { success: false, error: 'Не указан nodeId или clueId' },
        { status: 400 },
      )
    }

    const result = useStoryClue({
      game: context.game,
      progress: context.progress,
      nodeId,
      clueId,
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
