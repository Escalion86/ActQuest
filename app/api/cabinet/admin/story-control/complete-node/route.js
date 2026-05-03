import { NextResponse } from 'next/server'

import {
  adminCompleteNodeAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminCompleteNodeAction,
    })
  } catch (error) {
    console.error('Failed to complete story node', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось завершить локацию' },
      { status: 500 },
    )
  }
}
