import {
  adminUnlockInvestigationTopicAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminUnlockInvestigationTopicAction,
    })
  } catch (error) {
    console.error('Failed to unlock investigation topic', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось открыть тему' },
      { status: 500 },
    )
  }
}
import { NextResponse } from 'next/server'
