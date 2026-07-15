import {
  adminAdjustInvestigationTimeAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminAdjustInvestigationTimeAction,
    })
  } catch (error) {
    console.error('Failed to adjust investigation time', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось изменить игровое время' },
      { status: 500 },
    )
  }
}
import { NextResponse } from 'next/server'
