import { NextResponse } from 'next/server'

import {
  buildTeamStoryStatePayload,
  loadPlayerStoryContext,
} from '@app/api/cabinet/_lib/storyApi'
import { notifyAgentsForGameTeamProgress } from '@server/agentNotifications'

export async function GET(request, { params }) {
  try {
    const context = await loadPlayerStoryContext({ request, params })
    if (context.response) {
      return context.response
    }

    await notifyAgentsForGameTeamProgress({
      db: context.db,
      game: context.game,
      gameTeam: {
        ...(context.gameTeam.toObject?.() || context.gameTeam),
        storyProgress: context.progress,
      },
      team: context.team,
    })

    const payload = buildTeamStoryStatePayload(context)
    return NextResponse.json({ success: true, data: payload })
  } catch (error) {
    console.error('Failed to fetch story state', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось получить состояние story-квеста' },
      { status: 500 },
    )
  }
}
