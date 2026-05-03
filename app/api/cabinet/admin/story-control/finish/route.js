import { NextResponse } from 'next/server'

import {
  adminFinishAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminFinishAction,
    })
  } catch (error) {
    console.error('Failed to finish story quest', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось завершить story-квест' },
      { status: 500 },
    )
  }
}
