import { NextResponse } from 'next/server'

import {
  adminAdjustScoreAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminAdjustScoreAction,
    })
  } catch (error) {
    console.error('Failed to adjust story score', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось изменить баллы' },
      { status: 500 },
    )
  }
}
