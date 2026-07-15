import {
  adminSetInvestigationLocationAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminSetInvestigationLocationAction,
    })
  } catch (error) {
    console.error('Failed to set investigation location', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось изменить локацию' },
      { status: 500 },
    )
  }
}
import { NextResponse } from 'next/server'
