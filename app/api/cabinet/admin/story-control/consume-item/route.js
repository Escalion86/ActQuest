import { NextResponse } from 'next/server'

import {
  adminConsumeItemAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminConsumeItemAction,
    })
  } catch (error) {
    console.error('Failed to consume story item', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось изъять предмет' },
      { status: 500 },
    )
  }
}
