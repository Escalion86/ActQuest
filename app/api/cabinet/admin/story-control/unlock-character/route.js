import {
  adminUnlockInvestigationCharacterAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminUnlockInvestigationCharacterAction,
    })
  } catch (error) {
    console.error('Failed to unlock investigation character', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось открыть персонажа' },
      { status: 500 },
    )
  }
}
import { NextResponse } from 'next/server'
