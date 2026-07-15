import {
  adminGrantInvestigationEvidenceAction,
  runAdminStoryMutation,
} from '../_lib'

export async function POST(request) {
  try {
    return await runAdminStoryMutation({
      request,
      action: adminGrantInvestigationEvidenceAction,
    })
  } catch (error) {
    console.error('Failed to grant investigation evidence', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось выдать доказательство' },
      { status: 500 },
    )
  }
}
import { NextResponse } from 'next/server'
