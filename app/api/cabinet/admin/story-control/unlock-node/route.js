import { NextResponse } from 'next/server'

import {
  adminUnlockNodeAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminUnlockNodeAction,
    })
  } catch (error) {
    console.error('Failed to unlock story node', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось открыть локацию' },
      { status: 500 },
    )
  }
}
