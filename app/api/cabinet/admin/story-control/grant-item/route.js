import { NextResponse } from 'next/server'

import {
  adminGrantItemAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminGrantItemAction,
    })
  } catch (error) {
    console.error('Failed to grant story item', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось выдать предмет' },
      { status: 500 },
    )
  }
}
